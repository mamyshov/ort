import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { btnCls, btnGhostCls } from "@/components/loc-fields";
import { SiteShell } from "@/components/site-shell";
import { loc } from "@/lib/content";
import { getOrder, listPackages } from "@/lib/payments";
import { upsellAction } from "./actions";

export default async function UpsellPage({ params, searchParams }: PageProps<"/[locale]/upsell">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Funnel.upsell");
  const ref = (await searchParams).order;
  const order = typeof ref === "string" ? await getOrder(ref) : null;
  const [pkg] = await listPackages(true);
  if (!order || order.status !== "paid" || order.upsellOf || !pkg) {
    return (
      <SiteShell>
        <Link href="/app" className={`${btnCls} text-center`}>{t("skip")}</Link>
      </SiteShell>
    );
  }
  return (
    <SiteShell>
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      <p className="text-zinc-600">{t("text")}</p>
      <div className="rounded-3xl border border-zinc-200 bg-white shadow-card p-5">
        <h2 className="text-lg font-extrabold">{loc(pkg.title, locale)}</h2>
        <form action={upsellAction} className="mt-4">
          <input type="hidden" name="order" value={order.orderRef} />
          <input type="hidden" name="slug" value={pkg.slug} />
          <button type="submit" className={`${btnCls} w-full`}>{t("accept", { price: `$${pkg.priceUsd}` })}</button>
        </form>
      </div>
      <Link href="/app" className={`${btnGhostCls} text-center`}>{t("skip")}</Link>
    </SiteShell>
  );
}
