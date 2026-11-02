import { getTranslations, setRequestLocale } from "next-intl/server";
import { loc } from "@/lib/content";
import { requireUser } from "@/lib/guards";
import { hasPremium, listSections } from "@/lib/ort";
import { startPracticeAction } from "../actions";
import { Link } from "@/i18n/navigation";

const sel = "rounded-xl border-2 border-zinc-200 bg-white px-3 py-2 text-base";

export default async function PracticePage({ params, searchParams }: PageProps<"/[locale]/app/practice">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations("App.practice");
  const [sections, premium] = await Promise.all([listSections(), hasPremium(user.id)]);
  const empty = (await searchParams).empty;
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      <p className="text-zinc-600">{t("hint")}</p>
      {empty && <p role="alert" className="rounded-xl bg-sun-soft p-3 text-sm font-bold">{t("empty")}</p>}
      {!premium && <p className="rounded-xl bg-brand-soft p-3 text-sm">{t("freeNote")} <Link href="/pricing" className="font-bold underline">{t("upgrade")}</Link></p>}
      {sections.length === 0 && <p className="text-zinc-600">{t("noSections")}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((s) => {
          const available = premium ? s.total : s.free;
          return (
            <form key={s.id} action={startPracticeAction} className="flex flex-col gap-3 rounded-3xl border border-zinc-200 bg-white p-5 shadow-card">
              <input type="hidden" name="sectionId" value={s.id} />
              <div>
                <h2 className="text-lg font-extrabold">{loc(s.title, locale)}</h2>
                <p className="text-sm text-zinc-500">{t("count", { available, total: s.total })}</p>
              </div>
              {s.topics.length > 0 && (
                <label className="flex flex-col gap-1 text-sm font-bold">{t("topic")}
                  <select name="topicId" className={sel}>
                    <option value="">{t("allTopics")}</option>
                    {s.topics.map((x) => <option key={x.id} value={x.id}>{loc(x.title, locale)} ({x.total})</option>)}
                  </select>
                </label>
              )}
              <label className="flex flex-col gap-1 text-sm font-bold">{t("howMany")}
                <select name="count" defaultValue="10" className={sel}>{[10, 20, 30, 50].map((n) => <option key={n}>{n}</option>)}</select>
              </label>
              <button type="submit" disabled={available === 0} className="rounded-xl btn-primary px-4 py-2.5 font-bold text-white disabled:opacity-50">{t("start")}</button>
            </form>
          );
        })}
      </div>
    </div>
  );
}
