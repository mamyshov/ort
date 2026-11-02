"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { levelTestAction, type TextState } from "../ai/actions";
import { Link } from "@/i18n/navigation";

export function LevelForm() {
  const t = useTranslations("Ai");
  const [s, run, pending] = useActionState<TextState, FormData>(levelTestAction, null);
  return (
    <div className="flex flex-col gap-4">
      <form action={run} className="flex flex-col gap-3">
        <textarea name="text" rows={5} required minLength={10} maxLength={1500}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base" />
        <button type="submit" disabled={pending} className="rounded-xl btn-primary px-5 py-3 font-medium text-white disabled:opacity-60">
          {pending ? t("thinking") : t("level.submit")}
        </button>
      </form>
      {s?.error && <p role="alert" className="text-sm text-red-600">{t(`err.${s.error}` as "err.error")}</p>}
      {s?.level && (
        <div className="rounded-3xl border border-zinc-200 bg-white shadow-card p-4">
          <p className="text-xl font-extrabold">{t("level.result", { level: s.level })}</p>
          <p className="mt-2 whitespace-pre-line text-sm">{s.text}</p>
          <p className="mt-2 text-xs text-zinc-500">{t("label")}{s.mock && ` · ${t("mock")}`}</p>
          <Link href="/offer" className="mt-3 inline-block rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium">{t("level.offer")}</Link>
        </div>
      )}
    </div>
  );
}
