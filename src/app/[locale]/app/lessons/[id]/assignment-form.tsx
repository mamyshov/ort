"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { submitAssignmentAction, type AssignmentState } from "./actions";

export function AssignmentForm({ lessonId, resubmit }: { lessonId: string; resubmit: boolean }) {
  const t = useTranslations("App.exam");
  const locale = useLocale();
  const [state, action, pending] = useActionState<AssignmentState, FormData>(submitAssignmentAction, null);
  return (
    <form action={action} className="flex flex-col gap-3 rounded-3xl border border-zinc-200 bg-white shadow-card p-5">
      <input type="hidden" name="lessonId" value={lessonId} />
      <input type="hidden" name="locale" value={locale} />
      <label className="flex flex-col gap-1 text-sm">
        {t("yourAnswer")}
        <textarea name="text" rows={6} required className="rounded-lg border border-zinc-300 px-3 py-2 text-base" />
      </label>
      {state && "error" in state && <p role="alert" className="text-sm text-red-600">{t("empty")}</p>}
      <button type="submit" disabled={pending}
        className="self-start rounded-xl btn-primary px-5 py-2 text-sm font-medium text-white disabled:opacity-60">
        {pending ? t("checking") : resubmit ? t("resubmit") : t("send")}
      </button>
    </form>
  );
}
