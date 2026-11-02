import "server-only";
import { randomBytes } from "node:crypto";
import type { UiLocale } from "@/i18n/locales";
import { service, withUser } from "../db";
import { createPasswordReset, createUser } from "../auth";
import { sendMail, siteUrl } from "../mail";
import { createFinikCheckout } from "./finik";
import { kgsPerUsd, methodInfo, type Method } from "./methods";

export { availableMethods, mockEnabled } from "./methods";
export type { Method } from "./methods";

export type PackageRow = {
  id: string; slug: string; title: Record<string, string>; priceUsd: number; accessDays: number;
};

export async function listPackages(): Promise<PackageRow[]> {
  return service()<PackageRow[]>`
    select id, slug, title, price_usd::float as "priceUsd", access_days as "accessDays"
    from packages where is_active order by price_usd`;
}

export async function getPackage(slug: string) {
  const [p] = await service()<PackageRow[]>`
    select id, slug, title, price_usd::float as "priceUsd", access_days as "accessDays"
    from packages where slug = ${slug} and is_active`;
  return p ?? null;
}

export type OrderInput = {
  packageSlug: string; method: Method; name: string; email: string; phone: string; locale: string;
  userId?: string | null;
};

export type OrderResult = { orderRef: string; redirectUrl: string | null } | { error: "package" | "method" | "email" | "provider" };

export async function createOrder(i: OrderInput): Promise<OrderResult> {
  const pkg = await getPackage(i.packageSlug);
  if (!pkg) return { error: "package" };
  const info = methodInfo(i.method);
  if (!info) return { error: "method" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.email)) return { error: "email" };
  const sql = service();
  const [p] = await sql<{ id: string; order_ref: string }[]>`
    insert into payments (user_id, package_id, amount, method, payer_name, payer_email, payer_phone, locale, terms_accepted_at)
    values (${i.userId ?? null}, ${pkg.id}, ${pkg.priceUsd}, ${i.method}, ${i.name.trim().slice(0, 120)},
            ${i.email.trim().toLowerCase()}, ${i.phone.trim().slice(0, 40)}, ${i.locale}, now())
    returning id, order_ref`;
  let redirectUrl: string | null = null;
  if (info.kind === "redirect") {
    try {
      redirectUrl = (await createFinikCheckout({ orderRef: p.order_ref, amountUsd: pkg.priceUsd, returnUrl: `${siteUrl()}/${i.locale}/pay/${p.order_ref}` })).url;
    } catch {
      await sql`update payments set status = 'failed' where id = ${p.id}`;
      return { error: "provider" };
    }
  }
  return { orderRef: p.order_ref, redirectUrl };
}

export type PaymentView = {
  id: string; orderRef: string; status: "pending" | "paid" | "refunded" | "failed"; method: Method; amount: number;
  userId: string | null; packageSlug: string | null; packageTitle: Record<string, string> | null;
  payerName: string | null; payerEmail: string | null; locale: string;
};

export async function getOrder(orderRef: string): Promise<PaymentView | null> {
  if (!/^[0-9a-f]{32}$/.test(orderRef)) return null;
  const [p] = await service()<PaymentView[]>`
    select p.id, p.order_ref as "orderRef", p.status, p.method, p.amount::float as amount, p.user_id as "userId",
           k.slug as "packageSlug", k.title as "packageTitle", p.payer_name as "payerName",
           p.payer_email as "payerEmail", p.locale
    from payments p left join packages k on k.id = p.package_id where p.order_ref = ${orderRef}`;
  return p ?? null;
}

export const orderCode = (orderRef: string) => orderRef.slice(0, 8).toUpperCase();

/**
 * Единственное место, где платёж становится «оплачен» и открывается платный доступ.
 * Повторный вызов (повторное уведомление провайдера) ничего не меняет.
 */
export async function settlePayment(orderRef: string, providerRef?: string | null): Promise<{ ok: boolean; already?: boolean }> {
  const sql = service();
  const [p0] = await sql<{ id: string; status: string; user_id: string | null; payer_email: string | null;
    payer_name: string | null; payer_phone: string | null; locale: string }[]>`
    select id, status, user_id, payer_email, payer_name, payer_phone, locale from payments where order_ref = ${orderRef}`;
  if (!p0) return { ok: false };
  if (p0.status === "paid") return { ok: true, already: true };
  if (p0.status === "refunded") return { ok: false };

  // 1. Аккаунт покупателя
  let userId = p0.user_id;
  let isNew = false;
  if (!userId) {
    const email = (p0.payer_email ?? "").toLowerCase();
    const [ex] = await sql<{ id: string }[]>`select id from profiles where lower(email) = ${email}`;
    if (ex) userId = ex.id;
    else {
      userId = await createUser({
        email, password: randomBytes(18).toString("base64url"), fullName: p0.payer_name, phone: p0.payer_phone,
        locale: p0.locale as UiLocale,
      });
      if (!userId) {
        const [again] = await sql<{ id: string }[]>`select id from profiles where lower(email) = ${email}`;
        userId = again?.id ?? null;
      } else isNew = true;
    }
  }
  if (!userId) return { ok: false };

  // 2. Оплата и доступ в одной транзакции. Новый срок прибавляется к действующему.
  const changed = await sql.begin(async (tx) => {
    const [p] = await tx<{ id: string; status: string; package_id: string | null }[]>`
      select id, status, package_id from payments where id = ${p0.id} for update`;
    if (p.status !== "pending" && p.status !== "failed") return false;
    await tx`update payments set status = 'paid', paid_at = now(), user_id = ${userId},
             provider_ref = coalesce(${providerRef ?? null}, provider_ref) where id = ${p.id}`;
    if (p.package_id) {
      await tx`
        insert into subscriptions (user_id, package_id, payment_id, source, expires_at)
        select ${userId}, k.id, ${p.id}, 'payment',
               greatest(now(), coalesce((select max(expires_at) from subscriptions
                                         where user_id = ${userId} and status = 'active'), now()))
                 + make_interval(days => k.access_days)
        from packages k where k.id = ${p.package_id}`;
    }
    return true;
  });
  if (!changed) return { ok: true, already: true };

  // 3. Письмо с доступом. Новому покупателю — ссылка, чтобы задать пароль.
  try {
    if (p0.payer_email) {
      const setup = isNew ? await createPasswordReset(p0.payer_email) : null;
      const base = `${siteUrl()}/${p0.locale}`;
      const text = p0.locale === "ky"
        ? `Төлөм кабыл алынды. Кирүү: ${base}/login${setup ? `\nСырсөз коюу: ${base}/reset?token=${setup.token}` : ""}`
        : `Оплата получена. Вход: ${base}/login${setup ? `\nЗадать пароль: ${base}/reset?token=${setup.token}` : ""}`;
      await sendMail(p0.payer_email, "ORT Prep", text);
    }
  } catch (e) {
    console.error("Не удалось отправить письмо об оплате", e);
  }
  return { ok: true };
}

/** Автоподтверждение перевода (ЭЛСОМ, Kaspi): код заказа в комментарии, сумма сверяется. */
export async function confirmTransfer(i: {
  method: Method; code: string; amount: number; currency: string; txId: string;
}): Promise<"settled" | "not_found" | "amount_mismatch" | "duplicate" | "rate_missing"> {
  const sql = service();
  const code = i.code.trim().toUpperCase();
  if (!/^[0-9A-F]{8}$/.test(code)) return "not_found";
  const [dup] = await sql`select 1 from payments where method = ${i.method} and provider_ref = ${i.txId}`;
  if (dup) return "duplicate";
  const [p] = await sql<{ order_ref: string; amount: number }[]>`
    select order_ref, amount::float as amount from payments
    where method = ${i.method} and status = 'pending' and upper(substr(order_ref, 1, 8)) = ${code}`;
  if (!p) return "not_found";
  let usd = i.amount;
  if (i.currency.toUpperCase() === "KGS") {
    const rate = kgsPerUsd();
    if (!rate) return "rate_missing";
    usd = i.amount / rate;
  }
  // допуск 2% на колебания курса и округление
  if (usd < p.amount * 0.98) return "amount_mismatch";
  await settlePayment(p.order_ref, i.txId);
  return "settled";
}

/** Возврат: статус меняет сотрудник под защитой базы, затем закрывается доступ, выданный этим платежом. */
export async function refundPayment(staffId: string, paymentId: string): Promise<boolean> {
  let ok = false;
  try {
    ok = await withUser(staffId, async (tx) => {
      const r = await tx`
        update payments set status = 'refunded', refunded_by = ${staffId}, refunded_at = now()
        where id = ${paymentId} and status = 'paid' returning id`;
      if (r.length === 0) return false;
      await tx`insert into audit_log (actor_id, action, entity, entity_id)
               values (${staffId}, 'payment.refund', 'payment', ${paymentId})`;
      return true;
    });
  } catch {
    return false;
  }
  if (!ok) return false;
  await service()`update subscriptions set status = 'revoked', revoked_at = now() where payment_id = ${paymentId}`;
  return true;
}
