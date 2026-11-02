import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ProgressBar } from "@/components/progress-bar";
import { loc } from "@/lib/content";
import { getMyCourses, getStreak } from "@/lib/cabinet";
import { requireUser } from "@/lib/guards";

export default async function CabinetHome({ params }: PageProps<"/[locale]/app">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations("App.home");
  const courses = await getMyCourses(user.id);
  const streak = await getStreak(user.id);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-1 rounded-3xl bg-brand p-6 text-white shadow-card">
        <h1 className="text-3xl font-black">{t("greeting", { name: user.fullName?.trim() || user.email.split("@")[0] })}</h1>
        <p className="text-white/85">{t("greetingSub")}</p>
        <p className="mt-3 w-fit rounded-full bg-white/15 px-4 py-1.5 text-sm font-extrabold">
          {streak > 0 ? `🔥 ${t("streak", { n: streak })}` : t("streakNone")}
        </p>
      </section>
      <h2 className="text-xl font-extrabold">{t("title")}</h2>
      {courses.length === 0 && <p className="text-zinc-600">{t("empty")}</p>}
      <ul className="flex flex-col gap-4">
        {courses.map((c) => {
          const finished = c.total > 0 && c.done >= c.total;
          return (
            <li key={c.id} className="rounded-3xl border border-zinc-200 bg-white shadow-card p-5">
              <h3 className="text-lg font-extrabold">{loc(c.title, locale)}</h3>
              <p className="mt-1 text-sm text-zinc-600">{loc(c.description, locale)}</p>
              <div className="mt-4 flex flex-col gap-2">
                <ProgressBar done={c.done} total={c.total} label={loc(c.title, locale)} />
                <p className="text-sm text-zinc-600">
                  {finished ? t("completed") : t("progress", { done: c.done, total: c.total })}
                </p>
              </div>
              <div className="mt-4 flex gap-3">
                {c.nextLessonId && !finished && (
                  <Link
                    href={`/app/lessons/${c.nextLessonId}`}
                    className="rounded-xl btn-primary px-4 py-2 text-sm font-medium text-white"
                  >
                    {t("continue")}
                  </Link>
                )}
                <Link
                  href={`/app/courses/${c.slug}`}
                  className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium"
                >
                  {t("open")}
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
