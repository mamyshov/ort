"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { addChildAction, returnToParentAction, type ChildFormState, type ReturnState } from "./actions";

const field = "rounded-xl border-2 border-zinc-200 bg-white px-4 py-3 text-base";

export function AddChildForm() {
  const t = useTranslations("Children");
  const [state, action, pending] = useActionState<ChildFormState, FormData>(addChildAction, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state && "ok" in state) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-card">
      <h2 className="font-serif text-2xl font-bold">{t("addTitle")}</h2>
      <label className="flex flex-col gap-1 text-sm font-bold">{t("childName")}
        <input name="name" required minLength={2} maxLength={60} className={field} /></label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-bold">{t("age")}</legend>
        {(["kids", "teens"] as const).map((g, i) => (
          <label key={g} className="flex items-center gap-3 rounded-xl border-2 border-zinc-200 px-4 py-3">
            <input type="radio" name="ageGroup" value={g} required defaultChecked={i === 0} />{t(`ageGroup.${g}`)}
          </label>
        ))}
      </fieldset>
      {state && "error" in state && <p role="alert" className="text-sm font-bold text-red-600">{t(state.error === "limit" ? "limit" : "invalid")}</p>}
      {state && "ok" in state && <p role="status" className="text-sm font-bold text-green-700">{t("added")}</p>}
      <button type="submit" disabled={pending} className="btn-primary px-5 py-3">{t("add")}</button>
    </form>
  );
}

export function ReturnToParentForm() {
  const t = useTranslations("Children");
  const [state, action, pending] = useActionState<ReturnState, FormData>(returnToParentAction, null);
  return (
    <details className="group">
      <summary className="cursor-pointer list-none rounded-full bg-white/20 px-4 py-1.5 text-sm font-extrabold [&::-webkit-details-marker]:hidden">{t("backToParent")}</summary>
      <form action={action} className="absolute left-4 right-4 z-20 mt-2 flex max-w-sm flex-col gap-2 rounded-2xl bg-white p-4 text-ink shadow-card">
        <label className="flex flex-col gap-1 text-sm font-bold">{t("parentPassword")}
          <input name="password" type="password" required autoComplete="current-password" className={field} /></label>
        {state?.error && <p role="alert" className="text-sm font-bold text-red-600">{t(state.error === "limit" ? "limit" : "wrongPassword")}</p>}
        <button type="submit" disabled={pending} className="btn-primary px-4 py-2.5">{t("confirm")}</button>
      </form>
    </details>
  );
}
