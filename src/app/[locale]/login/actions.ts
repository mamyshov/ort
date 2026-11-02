"use server";

import { getLocale } from "next-intl/server";
import { isStaff, login, logout } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";

export type LoginState = { error: "invalid" | "throttled"; email: string } | null;

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const locale = await getLocale();
  const email = String(formData.get("email") ?? "");
  const result = await login(email, String(formData.get("password") ?? ""));
  if (!result.ok) return { error: result.reason, email };
  return redirect({ href: isStaff(result.user.role) ? "/admin" : "/app", locale });
}

export async function logoutAction() {
  const locale = await getLocale();
  await logout();
  return redirect({ href: "/", locale });
}
