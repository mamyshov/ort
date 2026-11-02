import { getTranslations, setRequestLocale } from "next-intl/server";
import { AiButton } from "@/components/ai-button";
import { AiChat } from "@/components/ai-chat";
import { requireUser } from "@/lib/guards";
import { partnerChatAction, studyPlanAction } from "../../ai/actions";

export default async function PracticePage({ params }: PageProps<"/[locale]/app/practice">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale);
  const t = await getTranslations("Ai");
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold">{t("practice.title")}</h1>
      <p className="text-zinc-600">{t("practice.intro")}</p>
      <AiChat action={partnerChatAction} placeholder={t("practice.placeholder")} />
      <section className="flex flex-col gap-3 rounded-3xl border border-zinc-200 bg-white shadow-card p-4">
        <h2 className="font-extrabold">{t("plan.title")}</h2>
        <AiButton action={studyPlanAction} label={t("plan.make")} />
      </section>
    </div>
  );
}
