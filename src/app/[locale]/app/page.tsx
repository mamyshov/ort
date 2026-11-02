import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { loc } from "@/lib/content";
import { requireUser } from "@/lib/guards";
import { listSections, premiumUntil } from "@/lib/ort";

export default async function CabinetHome({ params }: PageProps<"/[locale]/app">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations("App.home");
  const [sections, until] = await Promise.all([listSections(), premiumUntil(user.id)]);
  // Тест по языку школы показываем первым: кыргызоязычным — кыргызский, русскоязычным — русский
  const mine = user.schoolLanguage === "ky" ? "kyrgyz" : user.schoolLanguage === "ru" ? "russian" : null;
  const shown = sections.filter((s) => s.kind !== "kyrgyz" && s.kind !== "russian" || !mine || s.kind === mine);
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold">{t("hello", { name: user.fullName ?? "" })}</h1>
        <p className="text-zinc-600">{until ? t("premiumUntil", { date: fmt.format(until) }) : t("freePlan")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/app/practice" className="rounded-3xl btn-primary p-5 text-white"><b className="text-lg">{t("practice")}</b><br /><span className="text-sm opacity-90">{t("practiceText")}</span></Link>
        <Link href="/app/mock" className="rounded-3xl border-2 border-brand bg-white p-5"><b className="text-lg">{t("mock")}</b><br /><span className="text-sm text-zinc-600">{t("mockText")}</span></Link>
        <Link href="/app/history" className="rounded-3xl border-2 border-zinc-200 bg-white p-5"><b className="text-lg">{t("history")}</b><br /><span className="text-sm text-zinc-600">{t("historyText")}</span></Link>
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-extrabold">{t("sections")}</h2>
        {shown.length === 0 && <p className="text-zinc-600">{t("noSections")}</p>}
        <ul className="grid gap-3 sm:grid-cols-2">
          {shown.map((s) => (
            <li key={s.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
              <b>{loc(s.title, locale)}</b>
              <p className="text-sm text-zinc-500">{t("questions", { n: s.total })}</p>
              {s.topics.length > 0 && <p className="mt-1 text-xs text-zinc-500">{s.topics.map((x) => loc(x.title, locale)).join(" · ")}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
