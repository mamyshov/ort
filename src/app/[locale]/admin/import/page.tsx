import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/guards";
import { ImportForm } from "./import-form";

const EXAMPLE = `[
  {
    "section": "kyrgyz",
    "topic": { "ky": "Орфография" },
    "prompt": { "ky": "Кайсы катардагы сөздөрдүн бардыгы туура жазылган?" },
    "options": [ { "ky": "..." }, { "ky": "..." }, { "ky": "..." }, { "ky": "..." } ],
    "correct": "b",
    "explanation": { "ky": "..." },
    "free": false
  }
]`;

export default async function ImportPage({ params }: PageProps<"/[locale]/admin/import">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole(locale, ["owner"]);
  const t = await getTranslations("Admin.import");
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      <p className="text-zinc-600">{t("intro")}</p>
      <ul className="list-disc pl-5 text-sm text-zinc-700">
        <li>{t("rule1")}</li><li>{t("rule2")}</li><li>{t("rule3")}</li>
      </ul>
      <details className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm">
        <summary className="cursor-pointer font-bold">{t("format")}</summary>
        <pre className="mt-3 overflow-x-auto text-xs">{EXAMPLE}</pre>
        <p className="mt-3">{t("csvHint")}</p>
      </details>
      <ImportForm />
    </div>
  );
}
