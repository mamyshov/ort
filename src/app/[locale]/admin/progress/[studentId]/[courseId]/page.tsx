import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { loc } from "@/lib/content";
import { getStudentProgress } from "@/lib/progress";
import { requireRole } from "@/lib/guards";

export default async function StudentProgressPage({ params }: PageProps<"/[locale]/admin/progress/[studentId]/[courseId]">) {
  const { locale, studentId, courseId } = await params;
  setRequestLocale(locale);
  const user = await requireRole(locale, ["owner", "manager", "teacher"]);
  const p = await getStudentProgress(user.id, studentId, courseId);
  if (!p) notFound();
  const t = await getTranslations("Admin.progress");
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Link href="/admin/progress" className="text-sm text-zinc-600 underline">{t("back")}</Link>
      <div>
        <h1 className="text-2xl font-extrabold">{p.name || p.email}</h1>
        <p className="text-sm text-zinc-600">{p.email} · {loc(p.courseTitle, locale)}</p>
      </div>
      <ol className="flex flex-col gap-2">
        {p.lessons.map((l, idx) => {
          const mod = loc(l.moduleTitle, locale);
          const header = idx === 0 || mod !== loc(p.lessons[idx - 1].moduleTitle, locale) ? mod : null;
          const exam = l.kind === "exam";
          return (
            <li key={l.id} className="flex flex-col gap-2">
              {header && <h2 className="mt-3 text-sm font-extrabold text-zinc-500">{header}</h2>}
              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-bold">{loc(l.title, locale)}</span>
                  {l.doneAt ? (
                    <span className="shrink-0 text-sm font-bold text-emerald-700">✓ {fmt.format(new Date(l.doneAt))}</span>
                  ) : (
                    <span className="shrink-0 text-sm text-zinc-400">{t("notDone")}</span>
                  )}
                </div>
                {exam && (
                  <div className="mt-3 flex flex-col gap-2 text-sm">
                    <p className="text-zinc-500">{l.exam === "quiz" ? t("quiz") : t("assignment")} · {t("attempts", { n: l.attempts.length })}</p>
                    {l.attempts.map((a, i) => (
                      <details key={a.id} className="rounded-xl bg-zinc-50 p-3" open={i === l.attempts.length - 1 && !!a.text}>
                        <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="text-zinc-500">{fmt.format(new Date(a.at))}</span>
                          {a.status === "pending" ? (
                            <span className="font-bold text-amber-700">{t("waiting")}</span>
                          ) : (
                            <span className={`font-bold ${a.passed ? "text-emerald-700" : "text-red-600"}`}>
                              {a.score != null ? `${Math.round(a.score)}% · ` : ""}{a.passed ? t("pass") : t("fail")}
                            </span>
                          )}
                          {a.status === "reviewed" && l.exam === "assignment" && <span className="text-zinc-500">{a.byAi ? t("byAi") : t("byTeacher")}</span>}
                        </summary>
                        {a.text && <p className="mt-2 whitespace-pre-line rounded-lg bg-white p-3">{a.text}</p>}
                        {a.feedback && <p className="mt-2 whitespace-pre-line text-zinc-600"><span className="font-bold">{t("feedback")}: </span>{a.feedback}</p>}
                      </details>
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
