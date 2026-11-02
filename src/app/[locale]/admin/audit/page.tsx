import { getTranslations, setRequestLocale } from "next-intl/server";
import { listAudit } from "@/lib/admin";
import { requireRole } from "@/lib/guards";

export default async function AuditPage({ params }: PageProps<"/[locale]/admin/audit">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole(locale, ["owner"]);
  const t = await getTranslations("Admin.audit");
  const rows = await listAudit(user.id);
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" });
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      <ul className="flex flex-col gap-1 text-sm">
        {rows.map((r) => <li key={r.id} className="rounded-xl border border-zinc-200 bg-white px-3 py-2"><b>{r.action}</b> · {r.actor ?? "—"} · <span className="text-zinc-500">{fmt.format(r.createdAt)}</span></li>)}
      </ul>
    </div>
  );
}
