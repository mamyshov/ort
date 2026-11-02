import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ProgressBar } from "@/components/progress-bar";
import { loc } from "@/lib/content";
import { getCourseOutline } from "@/lib/cabinet";
import { requireUser } from "@/lib/guards";
import { myCertificates } from "@/lib/exams";

export default async function CoursePage({ params }: PageProps<"/[locale]/app/courses/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const course = await getCourseOutline(user.id, slug);
  if (!course) notFound();
  const t = await getTranslations("App.course");
  const tc = await getTranslations("App.certificate");
  const all = course.modules.flatMap((m) => m.lessons);
  const finished = all.length > 0 && all.every((l) => l.done);
  const cert = (await myCertificates(user.id)).find((c) => c.courseId === course.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold">{loc(course.title, locale)}</h1>
        <p className="mt-1 text-zinc-600">{loc(course.description, locale)}</p>
      </div>
      {cert ? (
        <Link href={`/certificate/${cert.number}`}
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          🎓 {tc("title")}: {tc("get")} →
        </Link>
      ) : finished && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{tc("waiting")}</p>
      )}
      {course.modules.map((m) => {
        const done = m.lessons.filter((l) => l.done).length;
        return (
          <section key={m.id} className="rounded-3xl border border-zinc-200 bg-white shadow-card p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-extrabold">{loc(m.title, locale)}</h2>
              <span className="text-sm text-zinc-600">
                {t("moduleProgress", { done, total: m.lessons.length })}
              </span>
            </div>
            <div className="mt-2">
              <ProgressBar done={done} total={m.lessons.length} label={loc(m.title, locale)} />
            </div>
            {m.lessons.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">{t("noLessons")}</p>
            ) : (
              <ul className="mt-3 flex flex-col">
                {m.lessons.map((l) => (
                  <li key={l.id}>
                    <Link
                      href={`/app/lessons/${l.id}`}
                      className="flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-zinc-50"
                    >
                      <span
                        aria-hidden
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                          l.done ? "border-emerald-600 bg-emerald-600 text-white" : "border-zinc-300"
                        }`}
                      >
                        {l.done ? "✓" : ""}
                      </span>
                      <span className="flex-1">{loc(l.title, locale)}</span>
                      <span className="text-xs text-zinc-500">
                        {t(`kind.${l.kind === "exam" ? (l.exam ?? "quiz") : l.kind}`)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
