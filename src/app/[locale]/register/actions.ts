"use server";

import { getLocale } from "next-intl/server";
import { createUser, MIN_PASSWORD_LENGTH, startSession } from "@/lib/auth";
import { UI_LOCALES, type UiLocale } from "@/i18n/locales";
import { redirect } from "@/i18n/navigation";
import { tooMany } from "@/lib/ratelimit";

export type RegisterState = { error: "invalid" | "taken" | "throttled"; name: string; email: string; phone: string } | null;

export async function registerStudentAction(_prev: RegisterState, fd: FormData): Promise<RegisterState> {
  const locale = await getLocale();
  const name = String(fd.get("name") ?? "").trim().slice(0, 120);
  const email = String(fd.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  const phone = String(fd.get("phone") ?? "").trim().slice(0, 25);
  const password = String(fd.get("password") ?? "");
  const school = String(fd.get("school") ?? "");
  const back = { name, email, phone };
  if (await tooMany("register", 6)) return { error: "throttled", ...back };
  const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (name.length < 2 || !okEmail || password.length < MIN_PASSWORD_LENGTH || password.length > 200
      || phone.replace(/\D/g, "").length < 8 || !["ru", "ky"].includes(school) || fd.get("consent") !== "on") {
    return { error: "invalid", ...back };
  }
  const id = await createUser({
    email, password, fullName: name, phone, role: "student", schoolLanguage: school as "ru" | "ky",
    locale: (UI_LOCALES as readonly string[]).includes(locale) ? (locale as UiLocale) : "ru",
  });
  if (!id) return { error: "taken", ...back };
  await startSession(id);
  return redirect({ href: "/app", locale });
}
