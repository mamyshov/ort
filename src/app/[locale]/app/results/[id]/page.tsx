import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { loc } from "@/lib/content";
import { requireUser } from "@/lib/guards";
import { closeExpired, reviewAttempt } from "@/lib/ort";
import { ExplainButton } from "./explain-button";

export default async function ResultsPage({ params }: PageProps<"/[locale]/app/results/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  await closeExpired(user.id);
  const r = await reviewAttempt(user.id, id);
  if (!r) notFound();
  const t = await getTranslations("App.results");
  const { attempt, items } = r;
  const total = attempt.total;
  const correct = attempt.correct ?? 0;
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const title = loc(attempt.mockTitle ?? attempt.sectionTitle, locale);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-bold text-zinc-500">{title}</p>
        <h1 className="text-3xl font-extrabold">{t("score", { correct, total })} · {pct}%</h1>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/app/practice" className="rounded-xl btn-primary px-4 py-2 text-sm font-bold text-white">{t("again")}</Link>
        <Link href="/app/history" className="rounded-xl border-2 border-zinc-200 bg-white px-4 py-2 text-sm font-bold">{t("history")}</Link>
      </div>
      <ol className="flex flex-col gap-4">
        {items.map((it, n) => {
          const ok = it.chosen === it.correctOption;
          return (
            <li key={it.id} className={`flex flex-col gap-3 rounded-3xl border-2 bg-white p-5 shadow-card ${ok ? "border-emerald-300" : "border-red-300"}`}>
              <p className="text-xs font-bold text-zinc-500">{n + 1} · {ok ? t("right") : it.chosen ? t("wrong") : t("skipped")}</p>
              {it.passage && <p className="whitespace-pre-line rounded-2xl bg-zinc-100 p-3 text-sm">{loc(it.passage, locale)}</p>}
              <p className="whitespace-pre-line font-bold">{loc(it.prompt, locale)}</p>
              <ul className="flex flex-col gap-1.5 text-sm">
                {it.options.map((o) => (
                  <li key={o.id} className={`rounded-lg px-3 py-2 ${o.id === it.correctOption ? "bg-emerald-50 font-bold" : o.id === it.chosen ? "bg-red-50" : ""}`}>
                    <span className="uppercase">{o.id}</span>) {loc(o.text, locale)}
                  </li>
                ))}
              </ul>
              {it.explanation && loc(it.explanation, locale) && <p className="whitespace-pre-line text-sm text-zinc-700">{loc(it.explanation, locale)}</p>}
              {!ok && <ExplainButton attemptId={attempt.id} questionId={it.id} />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
