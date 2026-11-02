"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { submitQuizAction, type QuizState } from "./actions";

type Q = { id: string; prompt: string; options: { id: string; text: string }[] };

export function QuizForm({ lessonId, questions }: { lessonId: string; questions: Q[] }) {
  const t = useTranslations("App.exam");
  const [state, action, pending] = useActionState<QuizState, FormData>(submitQuizAction, null);

  return (
    <form action={action} className="flex flex-col gap-5 rounded-3xl border border-zinc-200 bg-white shadow-card p-5">
      <input type="hidden" name="lessonId" value={lessonId} />
      {questions.map((q, i) => (
        <fieldset key={q.id} className="flex flex-col gap-2">
          <legend className="mb-1 font-medium">{i + 1}. {q.prompt}</legend>
          {q.options.map((o) => (
            <label key={o.id} className="flex items-center gap-3 rounded-lg border border-zinc-200 px-3 py-3">
              <input type="radio" name={`q_${q.id}`} value={o.id} required />
              {o.text}
            </label>
          ))}
        </fieldset>
      ))}
      {state && "error" in state && (
        <p role="alert" className="text-sm text-red-600">{t("answerAll")}</p>
      )}
      {state && "score" in state && (
        <div role="status" className={`rounded-xl p-3 text-sm ${state.passed ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
          <p className="font-medium">{t("score", { score: state.score })}</p>
          <p>{state.passed ? t("passed") : t("failed", { pass: state.passScore })}</p>
        </div>
      )}
      <button type="submit" disabled={pending}
        className="self-start rounded-xl btn-primary px-5 py-2 text-sm font-medium text-white disabled:opacity-60">
        {state && "score" in state ? t("retry") : t("submit")}
      </button>
    </form>
  );
}
