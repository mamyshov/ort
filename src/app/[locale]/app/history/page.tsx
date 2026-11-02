import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { loc } from "@/lib/content";
import { requireUser } from "@/lib/guards";
import { closeExpired, history, topicStats } from "@/lib/ort";

export default async function HistoryPage({ params }: PageProps<"/[locale]/app/history">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  await closeExpired(user.id);
  const t = await getTranslations("App.history");
  const [rows, stats] = await Promise.all([history(user.id), topicStats(user.id)]);
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" });
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      {stats.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-extrabold">{t("byTopic")}</h2>
          <ul className="flex flex-col gap-2">
            {stats.map((s, i) => {
              const pct = Math.round((s.correct / s.answered) * 100);
              return (
                <li key={i} className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="flex justify-between gap-3 text-sm font-bold">
                    <span>{loc(s.sectionTitle, locale)}{s.topicTitle ? ` · ${loc(s.topicTitle, locale)}` : ""}</span>
                    <span>{pct}% ({s.correct}/{s.answered})</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200" aria-hidden="true">
                    <div className={`h-full ${pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-sun" : "bg-coral"}`} style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-extrabold">{t("attempts")}</h2>
        {rows.length === 0 && <p className="text-zinc-600">{t("empty")}</p>}
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={r.status === "finished" ? `/app/results/${r.id}` : `/app/attempt/${r.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 hover:border-brand">
                <span className="flex flex-col">
                  <b>{loc(r.mockTitle ?? r.sectionTitle, locale) || t(r.kind)}</b>
                  <span className="text-xs text-zinc-500">{t(r.kind)} · {fmt.format(r.startedAt)}</span>
                </span>
                <b>{r.status === "finished" ? `${r.correct}/${r.total}` : t("inProgress")}</b>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
