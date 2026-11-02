import { getTranslations, setRequestLocale } from "next-intl/server";
import { aiUsage, dashboardCounts } from "@/lib/admin";
import { requireRole } from "@/lib/guards";

export default async function AdminHome({ params }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole(locale, ["owner", "manager"]);
  const t = await getTranslations("Admin");
  const c = await dashboardCounts();
  const usage = user.role === "owner" ? await aiUsage() : null;
  const cards = [
    [t("dash.students"), c.students], [t("dash.premium"), c.premium], [t("dash.published"), c.published],
    [t("dash.drafts"), c.drafts], [t("dash.attempts"), c.attempts],
  ] as const;
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold">{t("dash.title")}</h1>
      <p className="text-sm text-zinc-600">{t("dash.hello", { role: t(`role.${user.role}`) })}</p>
      <ul className="grid gap-3 sm:grid-cols-3">
        {cards.map(([label, n]) => (
          <li key={label} className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-card">
            <div className="text-3xl font-extrabold">{n}</div>
            <div className="text-sm text-zinc-600">{label}</div>
          </li>
        ))}
      </ul>
      {usage && <p className="text-sm text-zinc-600">{t("dash.aiLine", { n: usage.today, limit: usage.limit, week: usage.week })}</p>}
      {c.drafts > 0 && <p className="rounded-xl bg-sun-soft p-3 text-sm font-bold">{t("dash.draftsHint", { n: c.drafts })}</p>}
    </div>
  );
}
