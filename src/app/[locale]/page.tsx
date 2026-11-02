import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { loc } from "@/lib/content";
import { listPackages } from "@/lib/payments";

export const dynamic = "force-dynamic";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");
  const packages = await listPackages().catch(() => []);
  const parts = ["main", "language", "subjects"] as const;
  const how = ["practice", "mock", "review"] as const;
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <section className="bg-cream px-4 py-16 sm:px-6">
          <div className="mx-auto flex max-w-3xl flex-col items-start gap-5">
            <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">{t("title")}</h1>
            <p className="text-lg text-zinc-700">{t("subtitle")}</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/register" className="rounded-full bg-sun px-7 py-3.5 text-lg font-extrabold text-ink shadow-[0_4px_0_0_#d9a800]">{t("cta")}</Link>
              <Link href="/login" className="rounded-full border-2 border-zinc-300 bg-white px-7 py-3.5 text-lg font-bold">{t("login")}</Link>
            </div>
          </div>
        </section>
        <section id="goals" className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="mb-6 text-3xl font-extrabold">{t("structureTitle")}</h2>
          <ul className="grid gap-4 md:grid-cols-3">
            {parts.map((p) => (
              <li key={p} className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-card">
                <h3 className="text-xl font-extrabold">{t(`parts.${p}.title`)}</h3>
                <p className="mt-2 text-sm text-zinc-600">{t(`parts.${p}.text`)}</p>
              </li>
            ))}
          </ul>
        </section>
        <section id="how" className="bg-brand-soft px-4 py-14 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-6 text-3xl font-extrabold">{t("howTitle")}</h2>
            <ol className="grid gap-4 md:grid-cols-3">
              {how.map((h, i) => (
                <li key={h} className="rounded-3xl bg-white p-6 shadow-card">
                  <span className="text-3xl font-extrabold text-brand">{i + 1}</span>
                  <h3 className="mt-1 text-lg font-extrabold">{t(`how.${h}.title`)}</h3>
                  <p className="mt-1 text-sm text-zinc-600">{t(`how.${h}.text`)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <section id="prices" className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="mb-2 text-3xl font-extrabold">{t("pricesTitle")}</h2>
          <p className="mb-6 text-zinc-600">{t("pricesText")}</p>
          <ul className="grid gap-4 md:grid-cols-3">
            <li className="flex flex-col gap-2 rounded-3xl border border-zinc-200 bg-white p-6 shadow-card">
              <h3 className="text-xl font-extrabold">{t("freePlan")}</h3>
              <p className="flex-1 text-sm text-zinc-600">{t("freeText")}</p>
              <Link href="/register" className="rounded-xl border-2 border-brand px-4 py-2.5 text-center font-bold text-brand-dark">{t("cta")}</Link>
            </li>
            {packages.map((p) => (
              <li key={p.id} className="flex flex-col gap-2 rounded-3xl border-2 border-brand bg-white p-6 shadow-card">
                <h3 className="text-xl font-extrabold">{loc(p.title, locale)}</h3>
                <p className="text-3xl font-extrabold">${p.priceUsd}</p>
                <p className="flex-1 text-sm text-zinc-600">{t("paidText", { days: p.accessDays })}</p>
                <Link href={`/checkout/${p.slug}`} className="rounded-xl btn-primary px-4 py-2.5 text-center font-bold text-white">{t("buy")}</Link>
              </li>
            ))}
          </ul>
        </section>
        <section id="faq" className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6">
          <h2 className="mb-4 text-3xl font-extrabold">{t("faqTitle")}</h2>
          {(["q1", "q2", "q3"] as const).map((q) => (
            <details key={q} className="mb-2 rounded-2xl border border-zinc-200 bg-white p-4">
              <summary className="cursor-pointer font-bold">{t(`faq.${q}.q`)}</summary>
              <p className="mt-2 text-sm text-zinc-600">{t(`faq.${q}.a`)}</p>
            </details>
          ))}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
