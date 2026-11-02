import "server-only";
import { isDemoSite } from "./demo";

/** Адрес сайта для ссылок в письмах. */
export const siteUrl = () => (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");

/**
 * Отправка письма через Resend. В пробном режиме без ключа письмо только пишется в журнал сервера
 * (так видно ссылку сброса пароля при разработке).
 */
export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (isDemoSite()) {
      console.log(`[mail:dry-run] ${to} | ${subject}\n${text}`);
      return true;
    }
    console.error("RESEND_API_KEY не задан: письмо не отправлено");
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.MAIL_FROM || "ORT Prep <noreply@example.com>", to, subject, text }),
  });
  return res.ok;
}
