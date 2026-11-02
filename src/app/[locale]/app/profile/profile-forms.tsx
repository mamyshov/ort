"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { NATIVE_NAMES, UI_LOCALES } from "@/i18n/locales";
import { changePasswordAction, saveProfileAction, type ProfileState } from "./actions";

const input = "rounded-lg border border-zinc-300 px-3 py-2 text-base";
const submit = "self-start rounded-xl btn-primary px-5 py-2 text-sm font-medium text-white disabled:opacity-60";

export function ProfileForms(props: { name: string; phone: string; locale: string; school: string }) {
  const t = useTranslations("App.profile");
  const [s1, a1, p1] = useActionState<ProfileState, FormData>(saveProfileAction, null);
  const [s2, a2, p2] = useActionState<ProfileState, FormData>(changePasswordAction, null);

  return (
    <div className="flex flex-col gap-8">
      <form action={a1} className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white shadow-card p-5">
        <label className="flex flex-col gap-1 text-sm">
          {t("name")}
          <input name="name" defaultValue={props.name} className={input} autoComplete="name" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("phone")}
          <input name="phone" defaultValue={props.phone} className={input} type="tel" autoComplete="tel" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("language")}
          <select name="locale" defaultValue={props.locale} className={input}>
            {UI_LOCALES.map((x) => (
              <option key={x} value={x}>{NATIVE_NAMES[x]}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("school")}
          <select name="school" defaultValue={props.school} className={input}>
            <option value="">—</option>
            <option value="ru">{t("schoolRu")}</option>
            <option value="ky">{t("schoolKy")}</option>
          </select>
        </label>
        <button type="submit" disabled={p1} className={submit}>{t("save")}</button>
        {s1?.ok === "saved" && <p role="status" className="text-sm text-emerald-700">{t("saved")}</p>}
      </form>

      <form action={a2} className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white shadow-card p-5">
        <h2 className="text-lg font-extrabold">{t("changePassword")}</h2>
        <label className="flex flex-col gap-1 text-sm">
          {t("currentPassword")}
          <input name="current" type="password" required autoComplete="current-password" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("newPassword")}
          <input name="next" type="password" required minLength={8} autoComplete="new-password" className={input} />
        </label>
        <button type="submit" disabled={p2} className={submit}>{t("save")}</button>
        {s2?.ok === "passwordChanged" && <p role="status" className="text-sm text-emerald-700">{t("passwordChanged")}</p>}
        {s2?.error && <p role="alert" className="text-sm text-red-600">{t(s2.error)}</p>}
      </form>
    </div>
  );
}
