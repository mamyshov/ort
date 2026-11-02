"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { TextState } from "@/app/[locale]/ai/actions";

/** Кнопка, которая запускает одну функцию ИИ и показывает текстовый ответ. */
export function AiButton({
  action, label, fields,
}: { action: (s: TextState, fd: FormData) => Promise<TextState>; label: string; fields?: Record<string, string> }) {
  const t = useTranslations("Ai");
  const [state, run, pending] = useActionState<TextState, FormData>(action, null);
  return (
    <form action={run} className="flex flex-col gap-2">
      {Object.entries(fields ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button type="submit" disabled={pending}
        className="self-start rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-60">
        {pending ? t("thinking") : label}
      </button>
      {state?.error && <p role="alert" className="text-sm text-red-600">{t(`err.${state.error}` as "err.error")}</p>}
      {state?.text && (
        <div className="rounded-xl bg-sky-50 p-3 text-sm text-sky-950">
          <p className="whitespace-pre-line">{state.level ? `${state.level}: ` : ""}{state.text}</p>
          <p className="mt-2 text-xs text-sky-700">{t("label")}{state.mock && ` · ${t("mock")}`}</p>
        </div>
      )}
    </form>
  );
}
