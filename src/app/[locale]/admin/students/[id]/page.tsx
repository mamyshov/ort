import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { btnCls, btnGhostCls, inputCls } from "@/components/loc-fields";
import { loc } from "@/lib/content";
import { getStudent } from "@/lib/admin";
import { requireRole } from "@/lib/guards";
import { grantAccessAction, revokeAccessAction } from "../../actions";

export default async function StudentPage({ params, searchParams }: PageProps<"/[locale]/admin/students/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireRole(locale, ["owner", "manager"]);
  const s = await getStudent(user.id, id);
  if (!s) notFound();
  const t = await getTranslations("Admin");
  const failed = (await searchParams).error;
  const status = { active: "statusActive", revoked: "statusRevoked", expired: "statusExpired" } as const;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Link href="/admin/students" className="text-sm text-zinc-600 underline">{t("common.back")}</Link>
      <div>
        <h1 className="text-2xl font-extrabold">{s.name || s.email}</h1>
        <p className="text-sm text-zinc-600">{s.email}</p>
      </div>
      {failed && <p role="alert" className="text-sm text-red-600">{t("common.error")}</p>}
      <section className="flex flex-col gap-3 rounded-3xl border border-zinc-200 bg-white shadow-card p-5">
        <h2 className="text-lg font-extrabold">{t("students.access")}</h2>
        {s.enrollments.length === 0 && <p className="text-sm text-zinc-500">{t("common.none")}</p>}
        <ul className="flex flex-col gap-2">
          {s.enrollments.map((e) => (
            <li key={e.courseId} className="flex items-center justify-between gap-3">
              <span>
                {loc(e.title, locale)}
                <span className="ml-2 text-xs text-zinc-500">{t(`students.${status[e.status as keyof typeof status]}`)}</span>
              </span>
              {e.status === "active" && (
                <form action={revokeAccessAction}>
                  <input type="hidden" name="studentId" value={s.id} />
                  <input type="hidden" name="courseId" value={e.courseId} />
                  <button type="submit" className={btnGhostCls}>{t("students.revoke")}</button>
                </form>
              )}
            </li>
          ))}
        </ul>
        {s.grantable.length > 0 && (
          <form action={grantAccessAction} className="flex gap-2 border-t border-zinc-100 pt-3">
            <input type="hidden" name="studentId" value={s.id} />
            <select name="courseId" className={inputCls} aria-label={t("students.pickCourse")}>
              {s.grantable.map((c) => <option key={c.id} value={c.id}>{loc(c.title, locale)}</option>)}
            </select>
            <button type="submit" className={btnCls}>{t("students.grant")}</button>
          </form>
        )}
      </section>
    </div>
  );
}
