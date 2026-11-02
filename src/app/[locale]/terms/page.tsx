import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteShell } from "@/components/site-shell";

export default async function TermsPage({ params }: PageProps<"/[locale]/terms">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Funnel.terms");
  return (
    <SiteShell>
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t("draft")}</p>
      {(["s1", "s2", "s3", "s4"] as const).map((k) => <p key={k}>{t(k)}</p>)}
    </SiteShell>
  );
}
