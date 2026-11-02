import { getTranslations, setRequestLocale } from "next-intl/server";
import { FbPixel } from "@/components/fb-pixel";
import { SiteShell } from "@/components/site-shell";
import { LevelForm } from "./level-form";

export default async function LevelTestPage({ params }: PageProps<"/[locale]/level-test">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Ai.level");
  return (
    <SiteShell>
      <FbPixel />
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      <p className="text-zinc-600">{t("text")}</p>
      <LevelForm />
    </SiteShell>
  );
}
