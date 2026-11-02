import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Countdown } from "@/components/countdown";
import { FbPixel } from "@/components/fb-pixel";
import { SiteShell } from "@/components/site-shell";
import { getCurrentUser } from "@/lib/auth";
import { currentLead } from "@/lib/funnel";
import { offerDeadline } from "@/lib/payments";

export default async function ThanksPage({ params, searchParams }: PageProps<"/[locale]/webinar/thanks">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Funnel.thanks");
  const lead = (await searchParams).lead;
  const leadId = typeof lead === "string" && /^[0-9a-f-]{36}$/i.test(lead) ? lead : null;
  const me = await currentLead();
  const user = await getCurrentUser();
  const deadline = offerDeadline(me?.created_at ?? null);
  const active = deadline && deadline.getTime() > new Date().getTime();
  const bot = process.env.TELEGRAM_BOT_USERNAME;
  const btn = "block rounded-xl px-5 py-3 text-center font-medium";
  return (
    <SiteShell>
      <FbPixel event="Lead" />
      <h1 className="text-3xl font-extrabold tracking-tight">{t("title")}</h1>
      {active && (
        <p className="flex flex-wrap items-center gap-3 rounded-2xl bg-sun-soft p-4 font-bold text-ink">
          {t("timer")} <span className="rounded-lg bg-ink px-2 py-1 text-white"><Countdown deadline={deadline.toISOString()} /></span>
        </p>
      )}
      <div className="flex flex-col gap-3">
        <Link href="/offer" className={`${btn} btn-primary text-white`}>{t("offer")}</Link>
        {user && <Link href="/app" className={`${btn} border border-zinc-300`}>{t("cabinet")}</Link>}
        <Link href="/level-test" className={`${btn} border border-zinc-300`}>{t("test")}</Link>
        {bot && leadId && (
          <a href={`https://t.me/${bot}?start=${leadId}`} className={`${btn} border border-zinc-300`}>{t("telegram")}</a>
        )}
      </div>
    </SiteShell>
  );
}
