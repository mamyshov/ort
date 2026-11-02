"use server";

import { getCurrentUser, changePassword } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { UI_LOCALES } from "@/i18n/locales";

export type ProfileState = { ok?: "saved" | "passwordChanged"; error?: "passwordWrong" | "passwordShort" } | null;

const LOCALES: readonly string[] = UI_LOCALES;

export async function saveProfileAction(_: ProfileState, fd: FormData): Promise<ProfileState> {
  const user = await getCurrentUser();
  if (!user) return null;
  const name = String(fd.get("name") ?? "").trim().slice(0, 120) || null;
  const phone = String(fd.get("phone") ?? "").trim().slice(0, 40) || null;
  const locale = String(fd.get("locale") ?? "");
  const school = String(fd.get("school") ?? "");
  const lang = LOCALES.includes(locale) ? locale : user.locale;
  await withUser(user.id, (tx) =>
    tx`update profiles set full_name = ${name}, phone = ${phone}, locale = ${lang},
        school_language = ${school === "ru" || school === "ky" ? school : null} where id = ${user.id}`,
  );
  revalidatePath("/", "layout");
  return { ok: "saved" };
}

export async function changePasswordAction(_: ProfileState, fd: FormData): Promise<ProfileState> {
  const user = await getCurrentUser();
  if (!user) return null;
  const res = await changePassword(
    user.id,
    String(fd.get("current") ?? ""),
    String(fd.get("next") ?? ""),
  );
  if (res === "ok") return { ok: "passwordChanged" };
  return { error: res === "wrong" ? "passwordWrong" : "passwordShort" };
}
