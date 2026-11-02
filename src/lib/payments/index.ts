import "server-only";
import { randomBytes } from "node:crypto";
import type { UiLocale } from "@/i18n/locales";
import { service, withUser } from "../db";
import { createPasswordReset, createUser } from "../auth";
import { enqueueToContact, processQueue, siteUrl } from "../messaging";
import { createFinikCheckout } from "./finik";
import { kgsPerUsd, methodInfo, type Method } from "./methods";

export { availableMethods, mockEnabled } from "./methods";
export type { Method } from "./methods";

const OFFER_HOURS = () => Number(process.env.OFFER_HOURS) || 24;

export type PackageRow = {
  id: string; slug: string; title: Record<string, string>; priceUsd: number; listPriceUsd: number | null;
  isUpsell: boolean; courses: Record<string, string>[];
};

export async function listPackages(upsell: boolean): Promise<PackageRow[]> {
  return service()<PackageRow[]>`
    select p.id, p.slug, p.title, p.price_usd::float as "priceUsd", p.list_price_usd::float as "listPriceUsd",
           p.is_upsell as "isUpsell",
           coalesce((select jsonb_agg(c.title order by c.created_at) from package_courses pc
                     join courses c on c.id = pc.course_id where pc.package_id = p.id), '[]') as courses
    from packages p where p.is_active and p.is_upsell = ${upsell} order by p.price_usd`;
}

export async function getPackage(slug: string) {
  const [p] = await service()<PackageRow[]>`
    select id, slug, title, price_usd::float as "priceUsd", list_price_usd::float as "listPriceUsd",
           is_upsell as "isUpsell", '[]'::jsonb as courses
    from packages where slug = ${slug} and is_active`;
  return p ?? null;
}

/** Окно скидки считает сервер: от регистрации лида. Дальше действует обычная цена. */
export function offerDeadline(leadCreatedAt: Date | null): Date | null {
  return leadCreatedAt ? new Date(leadCreatedAt.getTime() + OFFER_HOURS() * 3600 * 1000) : null;
}

export function priceFor(pkg: Pick<PackageRow, "priceUsd" | "listPriceUsd">, leadCreatedAt: Date | null, now = new Date()) {
  if (pkg.listPriceUsd == null) return pkg.priceUsd;
  const deadline = offerDeadline(leadCreatedAt);
  return deadline && now < deadline ? pkg.priceUsd : pkg.listPriceUsd;
}

export type OrderInput = {
  packageSlug: string; method: Method; name: string; email: string; phone: string; locale: string;
  leadId?: string | null; upsellOf?: string | null; userId?: string | null;
};

export type OrderResult = { orderRef: string; redirectUrl: string | null } | { error: "package" | "method" | "email" | "provider" };

export async function createOrder(i: OrderInput): Promise<OrderResult> {
  const pkg = await getPackage(i.packageSlug);
  if (!pkg) return { error: "package" };
  const info = methodInfo(i.method);
  if (!info) return { error: "method" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.email)) return { error: "email" };
  const sql = service();
  let created: Date | null = null;
  if (i.leadId) {
    const [l] = await sql<{ created_at: Date }[]>`select created_at from leads where id = ${i.leadId}`;
    created = l?.created_at ?? null;
  }
  const amount = priceFor(pkg, created);
  const [p] = await sql<{ id: string; order_ref: string }[]>`
    insert into payments (user_id, lead_id, package_id, amount, method, payer_name, payer_email, payer_phone,
                          locale, terms_accepted_at, upsell_of)
    values (${i.userId ?? null}, ${i.leadId ?? null}, ${pkg.id}, ${amount}, ${i.method}, ${i.name.trim().slice(0, 120)},
            ${i.email.trim().toLowerCase()}, ${i.phone.trim().slice(0, 40)}, ${i.locale}, now(), ${i.upsellOf ?? null})
    returning id, order_ref`;
  if (i.leadId) await sql`insert into lead_events (lead_id, type, data) values (${i.leadId}, 'checkout_started', ${sql.json({ package: pkg.slug, amount })})`;
  let redirectUrl: string | null = null;
  if (info.kind === "redirect") {
    try {
      redirectUrl = (await createFinikCheckout({ orderRef: p.order_ref, amountUsd: amount, returnUrl: `${siteUrl()}/${i.locale}/pay/${p.order_ref}` })).url;
    } catch {
      await sql`update payments set status = 'failed' where id = ${p.id}`;
      return { error: "provider" };
    }
  }
  // Напоминание, если оплата не завершится за час. При оплате отменяется (см. settlePayment).
  try {
    await enqueueToContact({ phone: i.phone, email: i.email }, {
      template: "checkout_abandoned", locale: i.locale, leadId: i.leadId ?? null,
      sendAfter: new Date(Date.now() + 3600 * 1000),
      params: { name: i.name, link: `${siteUrl()}/${i.locale}/pay/${p.order_ref}`, orderRef: p.order_ref },
    });
  } catch (e) {
    console.error("Не удалось поставить напоминание об оплате", e);
  }
  return { orderRef: p.order_ref, redirectUrl };
}

export type PaymentView = {
  id: string; orderRef: string; status: "pending" | "paid" | "refunded" | "failed"; method: Method; amount: number;
  userId: string | null; packageSlug: string | null; packageTitle: Record<string, string> | null;
  payerName: string | null; payerEmail: string | null; locale: string; upsellOf: string | null;
};

export async function getOrder(orderRef: string): Promise<PaymentView | null> {
  if (!/^[0-9a-f]{32}$/.test(orderRef)) return null;
  const [p] = await service()<PaymentView[]>`
    select p.id, p.order_ref as "orderRef", p.status, p.method, p.amount::float as amount, p.user_id as "userId",
           k.slug as "packageSlug", k.title as "packageTitle", p.payer_name as "payerName",
           p.payer_email as "payerEmail", p.locale, p.upsell_of as "upsellOf"
    from payments p left join packages k on k.id = p.package_id where p.order_ref = ${orderRef}`;
  return p ?? null;
}

export const orderCode = (orderRef: string) => orderRef.slice(0, 8).toUpperCase();

/**
 * Единственное место, где платёж становится «оплачен» и открывается доступ.
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

  // 2. Оплата и доступ в одной транзакции
  const changed = await sql.begin(async (tx) => {
    const [p] = await tx<{ id: string; status: string; package_id: string | null; lead_id: string | null }[]>`
      select id, status, package_id, lead_id from payments where id = ${p0.id} for update`;
    if (p.status !== "pending" && p.status !== "failed") return false;
    await tx`update payments set status = 'paid', paid_at = now(), user_id = ${userId},
             provider_ref = coalesce(${providerRef ?? null}, provider_ref) where id = ${p.id}`;
    if (p.package_id) {
      await tx`
        insert into enrollments (user_id, course_id, package_id, source)
        select ${userId}, pc.course_id, ${p.package_id}, 'payment' from package_courses pc where pc.package_id = ${p.package_id}
        on conflict (user_id, course_id) do update
          set status = 'active', revoked_at = null, package_id = excluded.package_id, granted_at = now()`;
    }
    if (p.lead_id) {
      await tx`update leads set status = 'purchased', user_id = ${userId} where id = ${p.lead_id}`;
      await tx`insert into lead_events (lead_id, type, data) values (${p.lead_id}, 'purchased', ${tx.json({ paymentId: p.id })})`;
    }
    return true;
  });
  if (!changed) return { ok: true, already: true };
  await sql`update messages set status = 'cancelled'
            where status = 'queued' and template = 'checkout_abandoned' and params ->> 'orderRef' = ${orderRef}`;

  // 3. Сообщение с доступом. Новому покупателю — ссылка, чтобы задать пароль.
  try {
    const setup = isNew && p0.payer_email ? await createPasswordReset(p0.payer_email) : null;
    const base = `${siteUrl()}/${p0.locale}`;
    await enqueueToContact({ phone: p0.payer_phone, email: p0.payer_email }, {
      template: "payment_paid", locale: p0.locale, userId,
      params: {
        name: p0.payer_name ?? "", link: `${base}/login`,
        setup: setup ? `${base}/reset?token=${setup.token}` : `${base}/forgot`,
      },
    });
    await processQueue(5);
  } catch (e) {
    console.error("Не удалось поставить сообщение об оплате", e);
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

/** Возврат: статус меняет сотрудник под защитой базы, затем закрывается доступ по этому пакету. */
export async function refundPayment(staffId: string, paymentId: string): Promise<boolean> {
  let info: { user_id: string | null; package_id: string | null } | null = null;
  try {
    info = await withUser(staffId, async (tx) => {
      const r = await tx<{ user_id: string | null; package_id: string | null }[]>`
        update payments set status = 'refunded', refunded_by = ${staffId}, refunded_at = now()
        where id = ${paymentId} and status = 'paid' returning user_id, package_id`;
      if (r.length === 0) return null;
      await tx`insert into audit_log (actor_id, action, entity, entity_id)
               values (${staffId}, 'payment.refund', 'payment', ${paymentId})`;
      return r[0];
    });
  } catch {
    return false;
  }
  if (!info) return false;
  if (info.user_id && info.package_id) {
    // Не закрываем курс, если он же оплачен другим пакетом
    await service()`
      update enrollments e set status = 'revoked', revoked_at = now()
      where e.user_id = ${info.user_id} and e.package_id = ${info.package_id} and e.source = 'payment'
        and not exists (
          select 1 from payments p join package_courses pc on pc.package_id = p.package_id
          where p.user_id = e.user_id and p.status = 'paid' and p.id <> ${paymentId} and pc.course_id = e.course_id)`;
  }
  return true;
}
