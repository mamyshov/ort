"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { flashcardsAction, type CardsState } from "@/app/[locale]/ai/actions";

export function Flashcards({ lessonId }: { lessonId: string }) {
  const t = useTranslations("Ai");
  const [state, run, pending] = useActionState<CardsState, FormData>(flashcardsAction, null);
  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-zinc-200 bg-white shadow-card p-4">
      <h2 className="font-extrabold">{t("cards.title")}</h2>
      <form action={run}>
        <input type="hidden" name="lessonId" value={lessonId} />
        <button type="submit" disabled={pending} className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-60">
          {pending ? t("thinking") : t("cards.make")}
        </button>
      </form>
      {state?.error && <p role="alert" className="text-sm text-red-600">{t(`err.${state.error}` as "err.error")}</p>}
      {state?.cards && (
        <>
          <p className="text-xs text-zinc-500">{t("cards.hint")}</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {state.cards.map((c, i) => (
              <li key={i}>
                <details className="rounded-xl border border-zinc-200 p-3">
                  <summary className="cursor-pointer font-medium">{c.front}</summary>
                  <p className="mt-2 text-sm text-zinc-700">{c.back}</p>
                </details>
              </li>
            ))}
          </ul>
          <p className="text-xs text-zinc-500">{t("label")}{state.mock && ` · ${t("mock")}`}</p>
        </>
      )}
    </section>
  );
}
