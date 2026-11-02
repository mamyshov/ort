import { getTranslations, setRequestLocale } from "next-intl/server";
import { listAudit } from "@/lib/admin";
import { requireRole } from "@/lib/guards";

export default async function AuditPage({ params }: PageProps<"/[locale]/admin/audit">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole(locale, ["owner"]);
  const t = await getTranslations("Admin");
  const rows = await listAudit(user.id);
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" });
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold">{t("audit.title")}</h1>
      {rows.length === 0 && <p className="text-zinc-600">{t("common.none")}</p>}
      <div className="overflow-x-auto rounded-3xl border border-zinc-200 bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-zinc-500">
            <tr>
              <th className="p-3">{t("audit.when")}</th><th className="p-3">{t("audit.who")}</th>
              <th className="p-3">{t("audit.action")}</th><th className="p-3">{t("audit.object")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-zinc-100 last:border-0">
                <td className="whitespace-nowrap p-3">{fmt.format(r.at)}</td>
                <td className="p-3">{r.who}</td>
                <td className="p-3 font-mono text-xs">{r.action}</td>
                <td className="p-3 font-mono text-xs">{r.entity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
