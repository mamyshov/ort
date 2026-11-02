import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ProgressBar } from "@/components/progress-bar";
import { btnCls, inputCls } from "@/components/loc-fields";
import { loc } from "@/lib/content";
import { listCourses } from "@/lib/admin";
import { listProgress } from "@/lib/progress";
import { requireRole } from "@/lib/guards";

export default async function ProgressPage({ params, searchParams }: PageProps<"/[locale]/admin/progress">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole(locale, ["owner", "manager", "teacher"]);
  const t = await getTranslations("Admin.progress");
  const sp = await searchParams;
  const raw = (Array.isArray(sp.course) ? sp.course[0] : sp.course) ?? "";
  const courseId = /^[0-9a-f-]{36}$/i.test(raw) ? raw : null;
  const [rows, courses] = await Promise.all([listProgress(user.id, courseId), listCourses(user.id)]);
  const showExams = user.role !== "manager"; // менеджер не видит тесты и работы
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      <form className="flex gap-2">
        <select name="course" defaultValue={courseId ?? ""} className={inputCls} aria-label={t("course")}>
          <option value="">{t("allCourses")}</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{loc(c.title, locale)}</option>)}
        </select>
        <button type="submit" className={btnCls}>{t("show")}</button>
      </form>
      {rows.length === 0 && <p className="text-zinc-600">{t("empty")}</p>}
      <ul className="flex flex-col gap-3">
        {rows.map((r) => (
          <li key={`${r.studentId}-${r.courseId}`}>
            <Link href={`/admin/progress/${r.studentId}/${r.courseId}`}
              className="flex flex-col gap-3 rounded-3xl border border-zinc-200 bg-white p-5 shadow-card hover:border-brand">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-extrabold">{r.name || r.email}</span>
                <span className="text-sm text-zinc-500">{loc(r.courseTitle, locale)}</span>
              </div>
              <ProgressBar done={r.done} total={r.total} label={r.name || r.email} />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-600">
                <span>{t("lessons", { done: r.done, total: r.total })}</span>
                {showExams && r.examsPassed > 0 && <span className="font-bold text-emerald-700">✓ {t("passed", { n: r.examsPassed })}</span>}
                {showExams && r.examsFailed > 0 && <span className="font-bold text-red-600">✗ {t("failed", { n: r.examsFailed })}</span>}
                {showExams && r.examsPending > 0 && <span className="font-bold text-amber-700">… {t("pending", { n: r.examsPending })}</span>}
                <span className="ml-auto text-zinc-500">{r.lastActivity ? t("last", { date: fmt.format(new Date(r.lastActivity)) }) : t("never")}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
