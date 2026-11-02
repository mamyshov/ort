import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AiChat } from "@/components/ai-chat";
import { salesChatAction } from "../ai/actions";
import { Countdown } from "@/components/countdown";
import { FbPixel } from "@/components/fb-pixel";
import { SiteShell } from "@/components/site-shell";
import { loc } from "@/lib/content";
import { getCurrentUser } from "@/lib/auth";
import { isChildOf, listChildren } from "@/lib/children";
import { currentLead } from "@/lib/funnel";
import { listPackages, offerDeadline, priceFor } from "@/lib/payments";

export default async function OfferPage({ params, searchParams }: PageProps<"/[locale]/offer">) {
  const { locale } = await params;
  const childId = String((await searchParams).child ?? "");
  setRequestLocale(locale);
  const t = await getTranslations("Funnel.offer");
  const ta = await getTranslations("Ai");
  const lead = await currentLead();
  const me = await getCurrentUser();
  const forChild = me && !me.guardianId && childId && (await isChildOf(me.id, childId)) ? childId : null;
  const childName = forChild ? (await listChildren(me!.id)).find((c) => c.id === forChild)?.fullName : null;
  const tc = await getTranslations("Children");
  const packages = await listPackages(false);
  const deadline = offerDeadline(lead?.created_at ?? null);
  const active = !!deadline && deadline > new Date();
  const hasDiscount = packages.some((p) => p.listPriceUsd != null);
  return (
    <SiteShell narrow={false}>
      <FbPixel />
      <h1 className="text-3xl font-extrabold tracking-tight">{t("title")}</h1>
      {hasDiscount && (active ? (
        <p className="rounded-2xl bg-sun-soft p-4 font-bold text-ink">{t("timer")}: <Countdown deadline={deadline!.toISOString()} /></p>
      ) : !lead ? (
        <p className="flex flex-wrap items-center gap-3 rounded-2xl bg-sun-soft p-4 font-bold text-ink">
          {t("getDiscount")}
          <Link href="/register" className="rounded-full bg-sun px-5 py-2 text-sm font-extrabold shadow-[0_3px_0_0_#d9a800]">{t("getDiscountCta")}</Link>
        </p>
      ) : (
        <p className="rounded-xl bg-zinc-100 p-3 text-sm text-zinc-700">{t("expired")}</p>
      ))}
      {childName && <p className="rounded-2xl bg-sky/40 p-4 font-bold">{tc("buyingFor", { name: childName })}</p>}
      {packages.length === 0 && <p className="text-zinc-600">{t("empty")}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {packages.map((p) => {
          const price = priceFor(p, lead?.created_at ?? null);
          return (
            <section key={p.id} className="flex flex-col gap-3 rounded-3xl border border-zinc-200 bg-white shadow-card p-5">
              <h2 className="text-xl font-extrabold">{loc(p.title, locale)}</h2>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold">${price}</span>
                {p.listPriceUsd != null && price < p.listPriceUsd && (
                  <span className="text-zinc-400 line-through">${p.listPriceUsd}</span>
                )}
              </div>
              {p.courses.length > 0 && (
                <div className="text-sm text-zinc-600">
                  <div className="font-medium">{t("includes")}:</div>
                  <ul className="list-inside list-disc">{p.courses.map((c, i) => <li key={i}>{loc(c, locale)}</li>)}</ul>
                </div>
              )}
              <Link href={`/checkout/${p.slug}${forChild ? `?child=${forChild}` : ""}`} className="mt-auto rounded-xl btn-primary px-5 py-3 text-center font-medium text-white">
                {t("buy")}
              </Link>
            </section>
          );
        })}
      </div>
      <AiChat action={salesChatAction} title={ta("sales.title")} placeholder={ta("sales.placeholder")} />
    </SiteShell>
  );
}
