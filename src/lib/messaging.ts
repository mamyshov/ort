import "server-only";
import { getTranslations } from "next-intl/server";
import { service } from "./db";
import { isDemoSite } from "./demo";

export type Channel = "whatsapp" | "telegram" | "email";
export type Template =
  | "webinar_registered" | "webinar_reminder" | "payment_paid" | "password_reset" | "checkout_abandoned";

export type OutgoingMessage = {
  channel: Channel; to: string; template: Template; params: Record<string, string>;
  locale: string; leadId?: string | null; userId?: string | null; sendAfter?: Date;
};

export const siteUrl = () => (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export async function enqueue(m: OutgoingMessage) {
  await service()`
    insert into messages (channel, to_address, template, params, locale, lead_id, user_id, send_after)
    values (${m.channel}, ${m.to}, ${m.template}, ${service().json(m.params)}, ${m.locale},
            ${m.leadId ?? null}, ${m.userId ?? null}, ${m.sendAfter ?? new Date()})`;
}

/** Ставит сообщение во все доступные каналы клиента: WhatsApp по телефону, Telegram по привязанному чату, почта. */
export async function enqueueToContact(
  c: { phone?: string | null; email?: string | null; telegramChatId?: string | null },
  m: Omit<OutgoingMessage, "channel" | "to">,
) {
  const phone = c.phone?.replace(/[^\d+]/g, "");
  if (phone && phone.length >= 8) await enqueue({ ...m, channel: "whatsapp", to: phone });
  if (c.telegramChatId) await enqueue({ ...m, channel: "telegram", to: c.telegramChatId });
  if (c.email) await enqueue({ ...m, channel: "email", to: c.email });
}

async function render(m: { template: string; params: Record<string, string>; locale: string }) {
  const t = await getTranslations({ locale: m.locale, namespace: "Msg" });
  const text: string = t(m.template, m.params);
  const subject: string = t(`${m.template}_subject`, m.params);
  return { text, subject };
}

type Sender = (to: string, text: string, subject: string) => Promise<void>;

async function post(url: string, headers: Record<string, string>, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
}

/** Провайдеры. Если ключей нет, канал считается не настроенным. */
const senders: Record<Channel, { configured: () => boolean; send: Sender }> = {
  telegram: {
    configured: () => !!process.env.TELEGRAM_BOT_TOKEN,
    send: (to, text) =>
      post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {}, { chat_id: to, text }),
  },
  whatsapp: {
    // WhatsApp Cloud API. Первое сообщение клиенту вне 24-часового окна должно идти по одобренному шаблону Meta.
    configured: () => !!process.env.WHATSAPP_TOKEN && !!process.env.WHATSAPP_PHONE_ID,
    send: (to, text) =>
      post(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
        { authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
        { messaging_product: "whatsapp", to: to.replace(/^\+/, ""), type: "text", text: { body: text } }),
  },
  email: {
    configured: () => !!process.env.RESEND_API_KEY && !!process.env.MAIL_FROM,
    send: (to, text, subject) =>
      post("https://api.resend.com/emails", { authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        { from: process.env.MAIL_FROM, to, subject, text }),
  },
};

const MAX_ATTEMPTS = 5;
const dryRunAllowed = () => process.env.MESSAGING_DRY_RUN === "1" || isDemoSite();

/** Отправляет очередь. Вызывается по расписанию (см. /api/cron/messages) и сразу после важных событий. */
export async function processQueue(limit = 20): Promise<{ sent: number; failed: number }> {
  const sql = service();
  let sent = 0, failed = 0;
  const batch = await sql<{ id: string; channel: Channel; to_address: string; template: string;
    params: Record<string, string>; locale: string; attempts: number }[]>`
    update messages set attempts = attempts + 1
    where id in (select id from messages where status = 'queued' and send_after <= now() and attempts < ${MAX_ATTEMPTS}
                 order by send_after limit ${limit} for update skip locked)
    returning id, channel, to_address, template, params, locale, attempts`;
  for (const m of batch) {
    try {
      const { text, subject } = await render(m);
      const s = senders[m.channel];
      let note: string | null = null;
      if (s.configured()) await s.send(m.to_address, text, subject);
      else if (dryRunAllowed()) { console.log(`[сообщение:${m.channel}] ${m.to_address}: ${text}`); note = "пробная отправка: провайдер канала не настроен"; }
      else throw new Error("канал не настроен");
      await sql`update messages set status = 'sent', sent_at = now(), error = ${note} where id = ${m.id}`;
      sent++;
    } catch (e) {
      const final = m.attempts >= MAX_ATTEMPTS;
      await sql`update messages set status = ${final ? "failed" : "queued"},
                send_after = now() + (${m.attempts} * interval '5 minutes'), error = ${String(e).slice(0, 300)} where id = ${m.id}`;
      failed++;
    }
  }
  return { sent, failed };
}
