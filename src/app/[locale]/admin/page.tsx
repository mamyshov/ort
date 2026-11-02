import { getTranslations, setRequestLocale } from "next-intl/server";
import { AiButton } from "@/components/ai-button";
import { ownerSummaryAction } from "./ai-actions";
import { aiUsage, dashboardCounts } from "@/lib/admin";
import { requireRole } from "@/lib/guards";

export default async function AdminHome({ params }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole(locale, ["owner", "manager", "teacher"]);
  const t = await getTranslations("Admin");
  const c = await dashboardCounts(user.id);
  const usage = user.role === "owner" ? await aiUsage() : null;
  const cards = [
    [t("dash.students"), c.students],
    [t("dash.enrollments"), c.enrollments],
    [t("dash.courses"), c.courses],
  ] as const;
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold">{t("dash.title")}</h1>
      <p className="text-sm text-zinc-600">{t("dash.hello", { role: t(`role.${user.role}`) })}</p>
      <ul className="grid gap-3 sm:grid-cols-3">
        {cards.map(([label, n]) => (
          <li key={label} className="rounded-3xl border border-zinc-200 bg-white shadow-card p-5">
            <div className="text-3xl font-extrabold">{n}</div>
            <div className="text-sm text-zinc-600">{label}</div>
          </li>
        ))}
      </ul>
      {usage && (
        <section className="flex flex-col gap-2 rounded-3xl border border-zinc-200 bg-white p-5 shadow-card">
          <h2 className="text-lg font-extrabold">{t("dash.aiTitle")}</h2>
          <p className="text-sm text-zinc-600">{usage.today > 0 || usage.week > 0 ? t("dash.aiLine", { n: usage.today, limit: usage.limit, week: usage.week }) : t("dash.aiNone")}</p>
          {usage.byFeature.length > 0 && (
            <ul className="flex flex-wrap gap-2 text-sm">
              {usage.byFeature.map((f) => <li key={f.feature} className="rounded-full bg-brand-soft px-3 py-1 font-bold text-brand-dark">{f.feature}: {f.n}</li>)}
            </ul>
          )}
        </section>
      )}
      {user.role === "owner" && <AiButton action={ownerSummaryAction} label={t("ai.summary")} />}
    </div>
  );
}
