"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { registerStudentAction, type RegisterState } from "./actions";

const field = "rounded-xl border-2 border-zinc-200 bg-white px-4 py-3 text-base";

export function RegisterForm({ child = false }: { child?: boolean }) {
  const t = useTranslations("Register");
  const [state, action, pending] = useActionState<RegisterState, FormData>(registerStudentAction, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      {child && (
        <div className="flex flex-col gap-4 rounded-2xl bg-sky/30 p-4">
          <p className="font-extrabold">{t("childBlock")}</p>
          <label className="flex flex-col gap-1 text-sm font-bold">{t("childName")}
            <input name="childName" required minLength={2} maxLength={60} className={field} /></label>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-bold">{t("childAge")}</legend>
            {(["kids", "teens"] as const).map((g, i) => (
              <label key={g} className="flex items-center gap-3 rounded-xl border-2 border-zinc-200 bg-white px-4 py-3">
                <input type="radio" name="ageGroup" value={g} required defaultChecked={i === 0} />{t(`ageGroup.${g}`)}
              </label>
            ))}
          </fieldset>
          <p className="text-sm text-zinc-600">{t("parentNote")}</p>
        </div>
      )}
      <label className="flex flex-col gap-1 text-sm font-bold">{child ? t("parentName") : t("name")}
        <input name="name" required minLength={2} defaultValue={state?.name ?? ""} autoComplete="name" className={field} /></label>
      <label className="flex flex-col gap-1 text-sm font-bold">{t("email")}
        <input name="email" type="email" required defaultValue={state?.email ?? ""} autoComplete="email" className={field} /></label>
      <label className="flex flex-col gap-1 text-sm font-bold">{t("phone")}
        <input name="phone" type="tel" required defaultValue={state?.phone ?? ""} autoComplete="tel" placeholder="+996" className={field} /></label>
      <label className="flex flex-col gap-1 text-sm font-bold">{t("password")}
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className={field} />
        <span className="text-xs font-medium text-zinc-500">{t("hint")}</span></label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="consent" required className="mt-1 size-4" />
        <span>{t("consent")} (<Link href="/terms" className="underline">{t("terms")}</Link>)</span>
      </label>
      {state?.error && <p role="alert" className="text-sm font-bold text-red-600">{t(state.error)}</p>}
      <button type="submit" disabled={pending} className="btn-primary px-5 py-3.5 text-lg">{t("submit")}</button>
      <p className="text-center text-sm text-zinc-600">{t("have")} <Link href="/login" className="font-extrabold text-brand underline">{t("login")}</Link></p>
    </form>
  );
}
