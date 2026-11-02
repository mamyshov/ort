"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { consumePasswordReset, MIN_PASSWORD_LENGTH } from "@/lib/auth";

export async function resetAction(fd: FormData) {
  const locale = await getLocale();
  const token = String(fd.get("token") ?? "");
  const password = String(fd.get("password") ?? "");
  const ok = token.length > 20 && password.length >= MIN_PASSWORD_LENGTH && (await consumePasswordReset(token, password));
  return redirect({ href: ok ? "/reset?done=1" : `/reset?error=1&token=${encodeURIComponent(token)}`, locale });
}
