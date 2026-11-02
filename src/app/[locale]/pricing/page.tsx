import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteShell } from "@/components/site-shell";
import { loc } from "@/lib/content";
import { listPackages } from "@/lib/payments";

export const dynamic = "force-dynamic";

export default async function PricingPage({ params }: PageProps<"/[locale]/pricing">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");
  const packages = await listPackages().catch(() => []);
  return (
    <SiteShell>
      <h1 className="text-2xl font-extrabold">{t("pricesTitle")}</h1>
      <p className="text-zinc-600">{t("pricesText")}</p>
      {packages.length === 0 && <p className="rounded-xl bg-sun-soft p-4 font-bold">{t("noPackages")}</p>}
      {packages.map((p) => (
        <div key={p.id} className="flex flex-col gap-2 rounded-3xl border-2 border-brand bg-white p-6 shadow-card">
          <h2 className="text-xl font-extrabold">{loc(p.title, locale)}</h2>
          <p className="text-3xl font-extrabold">${p.priceUsd}</p>
          <p className="text-sm text-zinc-600">{t("paidText", { days: p.accessDays })}</p>
          <Link href={`/checkout/${p.slug}`} className="rounded-xl btn-primary px-4 py-2.5 text-center font-bold text-white">{t("buy")}</Link>
        </div>
      ))}
    </SiteShell>
  );
}
