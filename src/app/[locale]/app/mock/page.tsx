import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { loc } from "@/lib/content";
import { requireUser } from "@/lib/guards";
import { hasPremium, listMocks } from "@/lib/ort";
import { startMockAction } from "../actions";

export default async function MockPage({ params, searchParams }: PageProps<"/[locale]/app/mock">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations("App.mock");
  const [mocks, premium] = await Promise.all([listMocks(), hasPremium(user.id)]);
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      <p className="text-zinc-600">{t("hint")}</p>
      {(await searchParams).empty && <p role="alert" className="rounded-xl bg-sun-soft p-3 text-sm font-bold">{t("empty")}</p>}
      {mocks.length === 0 && <p className="text-zinc-600">{t("none")}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {mocks.map((m) => (
          <form key={m.id} action={startMockAction} className="flex flex-col gap-3 rounded-3xl border border-zinc-200 bg-white p-5 shadow-card">
            <input type="hidden" name="mockId" value={m.id} />
            <h2 className="text-lg font-extrabold">{loc(m.title, locale)}</h2>
            <p className="text-sm text-zinc-500">{t("info", { total: m.total, minutes: m.durationMin })} {m.isFree ? `· ${t("free")}` : ""}</p>
            {m.isFree || premium
              ? <button type="submit" className="rounded-xl btn-primary px-4 py-2.5 font-bold text-white">{t("start")}</button>
              : <Link href="/pricing" className="rounded-xl border-2 border-brand px-4 py-2.5 text-center font-bold text-brand-dark">{t("locked")}</Link>}
          </form>
        ))}
      </div>
    </div>
  );
}
