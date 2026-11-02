import "server-only";
import { cookies } from "next/headers";
import { service } from "./db";
import { enqueueToContact, siteUrl } from "./messaging";
import { offerDeadline } from "./payments";

export const LEAD_COOKIE = "lead";

export type LeadInput = {
  name: string; phone: string; email: string; locale: string; source: string; utm: Record<string, string>;
};

export const formatWhen = (d: Date, locale: string) =>
  new Intl.DateTimeFormat(locale, {
    dateStyle: "long", timeStyle: "short", timeZone: process.env.WEBINAR_TZ || "Asia/Bishkek",
  }).format(d);

export const groupUrl = (locale: string) => `${siteUrl()}/${locale}/offer`;

/** Регистрация: лид, сообщение со ссылкой на личное предложение и напоминание перед концом скидки. Лид запоминается в cookie. */
export async function registerLead(i: LeadInput): Promise<string | null> {
  const name = i.name.trim().slice(0, 120);
  const phone = i.phone.replace(/[^\d+]/g, "").slice(0, 20);
  const email = i.email.trim().toLowerCase().slice(0, 200);
  if (name.length < 2 || phone.replace(/\D/g, "").length < 8) return null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  const sql = service();
  // Тот же телефон за последние 30 дней — тот же лид (повторная отправка формы не плодит дубли)
  const [ex] = await sql<{ id: string }[]>`
    select id from leads where phone = ${phone} and created_at > now() - interval '30 days' order by created_at desc limit 1`;
  let leadId = ex?.id;
  if (!leadId) {
    const [l] = await sql<{ id: string }[]>`
      insert into leads (name, phone, email, source, utm) values (${name}, ${phone}, ${email || null}, ${i.source}, ${sql.json(i.utm)})
      returning id`;
    leadId = l.id;
    await sql`insert into lead_events (lead_id, type) values (${leadId}, 'registered')`;
    const base = { locale: i.locale, leadId };
    const group = groupUrl(i.locale);
    const contact = { phone, email: email || null };
    const deadline = offerDeadline(new Date());
    const whenText = deadline ? formatWhen(deadline, i.locale) : "";
    await enqueueToContact(contact, { ...base, template: "webinar_registered", params: { name, group, when: whenText } });
    // Напоминание за 3 часа до конца личной скидки
    const at = deadline ? new Date(deadline.getTime() - 3 * 3600 * 1000) : null;
    if (at && at > new Date()) {
      await enqueueToContact(contact, { ...base, template: "webinar_reminder", sendAfter: at, params: { name, group, when: whenText } });
    }
  }
  (await cookies()).set(LEAD_COOKIE, leadId, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: 30 * 24 * 3600,
  });
  return leadId;
}

export async function currentLead() {
  const id = (await cookies()).get(LEAD_COOKIE)?.value;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [l] = await service()<{ id: string; name: string | null; phone: string | null; email: string | null; created_at: Date }[]>`
    select id, name, phone, email, created_at from leads where id = ${id}`;
  return l ?? null;
}
