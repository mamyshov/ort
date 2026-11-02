"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createPasswordReset } from "@/lib/auth";
import { tooMany } from "@/lib/ratelimit";
import { sendMail, siteUrl } from "@/lib/mail";

/** Ответ одинаков, есть такая почта или нет: так нельзя проверить, кто зарегистрирован. */
export async function forgotAction(fd: FormData) {
  const locale = await getLocale();
  if (await tooMany("forgot", 5)) return redirect({ href: "/forgot?sent=1", locale });
  const email = String(fd.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  const r = email ? await createPasswordReset(email) : null;
  if (r) {
    const link = `${siteUrl()}/${locale}/reset?token=${r.token}`;
    await sendMail(email, "ORT Prep", locale === "ky" ? `Сырсөздү калыбына келтирүү: ${link}` : `Сброс пароля: ${link}`).catch(() => {});
  }
  return redirect({ href: "/forgot?sent=1", locale });
}
