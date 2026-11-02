"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { importAction, type ImportState } from "../actions";

export function ImportForm() {
  const t = useTranslations("Admin.import");
  const [state, action, pending] = useActionState<ImportState, FormData>(importAction, null);
  return (
    <div className="flex flex-col gap-5">
      <form action={action} className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-card">
        <label className="flex flex-col gap-1 text-sm font-bold">{t("file")}
          <input type="file" name="file" accept=".json,.csv,.txt" className="text-sm font-normal" /></label>
        <label className="flex flex-col gap-1 text-sm font-bold">{t("orPaste")}
          <textarea name="body" rows={10} className="rounded-xl border-2 border-zinc-200 p-3 font-mono text-xs" /></label>
        <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="dryRun" defaultChecked />{t("dryRun")}</label>
        <button type="submit" disabled={pending} className="self-start rounded-xl btn-primary px-5 py-2.5 font-bold text-white">{pending ? t("working") : t("run")}</button>
      </form>
      {state && "parseError" in state && <p role="alert" className="text-sm font-bold text-red-600">{t("parseError")}</p>}
      {state && "report" in state && (
        <div role="status" className="flex flex-col gap-3 rounded-3xl border border-zinc-200 bg-white p-5 shadow-card">
          <h2 className="text-lg font-extrabold">{state.dryRun ? t("checkResult") : t("doneResult")}</h2>
          <ul className="text-sm">
            <li>{t("added", { n: state.report.added })} ({t("published", { n: state.report.published })}, {t("drafts", { n: state.report.drafts })})</li>
            <li>{t("duplicates", { n: state.report.duplicates.length })}</li>
            <li>{t("errors", { n: state.report.errors.length })}</li>
          </ul>
          {state.report.duplicates.length > 0 && (
            <details open><summary className="cursor-pointer font-bold">{t("duplicatesList")}</summary>
              <ul className="mt-2 list-disc pl-5 text-sm">{state.report.duplicates.map((d) => <li key={d.index}>№{d.index + 1}: {d.prompt}</li>)}</ul></details>
          )}
          {state.report.errors.length > 0 && (
            <details open><summary className="cursor-pointer font-bold">{t("errorsList")}</summary>
              <ul className="mt-2 list-disc pl-5 text-sm">{state.report.errors.map((d) => <li key={d.index}>№{d.index + 1}: {d.message}</li>)}</ul></details>
          )}
        </div>
      )}
    </div>
  );
}
