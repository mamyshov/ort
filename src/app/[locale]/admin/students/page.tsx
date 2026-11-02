import { getTranslations, setRequestLocale } from "next-intl/server";
import { btnGhostCls, inputCls } from "@/components/loc-fields";
import { listStudents } from "@/lib/admin";
import { requireRole } from "@/lib/guards";
import { grantAction, revokeAction } from "../actions";

export default async function StudentsPage({ params, searchParams }: PageProps<"/[locale]/admin/students">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole(locale, ["owner", "manager"]);
  const t = await getTranslations("Admin.students");
  const q = String((await searchParams).q ?? "").slice(0, 100);
  const rows = await listStudents(user.id, q);
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "short" });
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      <form method="get" className="flex gap-2"><input name="q" defaultValue={q} placeholder={t("search")} className={inputCls + " !w-64"} /><button className={btnGhostCls}>{t("find")}</button></form>
      <div className="overflow-x-auto rounded-3xl border border-zinc-200 bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-zinc-500"><tr>
            <th className="p-3">{t("student")}</th><th className="p-3">{t("school")}</th><th className="p-3">{t("attempts")}</th><th className="p-3">{t("access")}</th><th className="p-3" /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-zinc-100 last:border-0 align-top">
                <td className="p-3">{r.fullName}<div className="text-xs text-zinc-500">{r.email}</div></td>
                <td className="p-3">{r.schoolLanguage ? t(`lang.${r.schoolLanguage}` as "lang.ru") : "—"}</td>
                <td className="p-3">{r.attempts}</td>
                <td className="p-3">{r.until ? t("until", { date: fmt.format(r.until) }) : t("free")}</td>
                <td className="flex flex-wrap gap-2 p-3">
                  <form action={grantAction} className="flex gap-1"><input type="hidden" name="id" value={r.id} />
                    <input name="days" type="number" min={1} max={730} defaultValue={30} className={inputCls + " !w-20 !py-1.5"} aria-label={t("days")} />
                    <button className={btnGhostCls}>{t("grant")}</button></form>
                  {r.until && <form action={revokeAction}><input type="hidden" name="id" value={r.id} /><button className={btnGhostCls}>{t("revoke")}</button></form>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
