"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { explainAction } from "../../actions";

export function ExplainButton({ attemptId, questionId }: { attemptId: string; questionId: string }) {
  const t = useTranslations("App.results");
  const [text, setText] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      {text === null && (
        <button type="button" disabled={pending} className="self-start rounded-xl border-2 border-brand px-3 py-1.5 text-sm font-bold text-brand-dark"
          onClick={() => start(async () => {
            const r = await explainAction(attemptId, questionId);
            if ("text" in r) setText(r.text); else setErr(r.error);
          })}>{pending ? t("aiLoading") : t("aiExplain")}</button>
      )}
      {text && <p role="status" className="whitespace-pre-line rounded-xl bg-sun-soft p-3 text-sm"><b>{t("aiLabel")}</b> {text}</p>}
      {err && <p role="alert" className="text-sm text-red-600">{t(`aiError.${err}` as "aiError.error")}</p>}
    </div>
  );
}
