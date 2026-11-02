"use server";

import { getLocale } from "next-intl/server";
import { addChild } from "@/lib/children";
import { createUser, MIN_PASSWORD_LENGTH, startSession } from "@/lib/auth";
import { UI_LOCALES, type UiLocale } from "@/i18n/locales";
import { redirect } from "@/i18n/navigation";
import { registerLead } from "@/lib/funnel";
import { processQueue } from "@/lib/messaging";
import { tooMany } from "@/lib/ratelimit";

export type RegisterState = { error: "invalid" | "taken" | "throttled"; name: string; email: string; phone: string } | null;

export async function registerStudentAction(_prev: RegisterState, fd: FormData): Promise<RegisterState> {
  const locale = await getLocale();
  const name = String(fd.get("name") ?? "").trim().slice(0, 120);
  const email = String(fd.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  const phone = String(fd.get("phone") ?? "").trim().slice(0, 25);
  const password = String(fd.get("password") ?? "");
  const back = { name, email, phone };
  if (await tooMany("register", 6)) return { error: "throttled", ...back };
  const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const childMode = String(fd.get("childName") ?? "").trim().length > 0;
  if (childMode && String(fd.get("childName")).trim().length < 2) return { error: "invalid", ...back };
  if (name.length < 2 || !okEmail || password.length < MIN_PASSWORD_LENGTH || password.length > 200 || phone.replace(/\D/g, "").length < 8 || fd.get("consent") !== "on") {
    return { error: "invalid", ...back };
  }
  const id = await createUser({
    email, password, fullName: name, role: "student",
    locale: (UI_LOCALES as readonly string[]).includes(locale) ? (locale as UiLocale) : "ru",
  });
  if (!id) return { error: "taken", ...back };
  await startSession(id);
  const childName = String(fd.get("childName") ?? "").trim();
  if (childName) await addChild({ id, locale: (UI_LOCALES as readonly string[]).includes(locale) ? (locale as UiLocale) : "ru", guardianId: null }, childName, String(fd.get("ageGroup") ?? "kids"));
  // Личная скидка: регистрация тоже создаёт лид, поэтому таймер и сообщение работают так же
  const lead = await registerLead({ name, phone, email, locale, source: "register", utm: {} }).catch(() => null);
  await processQueue(5).catch(() => {});
  if (childName) return redirect({ href: "/app/children?new=1", locale });
  return redirect({ href: lead ? `/webinar/thanks?lead=${lead}` : "/app", locale });
}
