import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocFields, btnCls, inputCls } from "@/components/loc-fields";
import { loc } from "@/lib/content";
import { listCourses } from "@/lib/admin";
import { requireRole } from "@/lib/guards";
import { createCourseAction } from "../actions";

export default async function CoursesPage({ params, searchParams }: PageProps<"/[locale]/admin/courses">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole(locale, ["owner", "manager", "teacher"]);
  const t = await getTranslations("Admin");
  const courses = await listCourses(user.id);
  const failed = (await searchParams).error;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold">{t("courses.title")}</h1>
      {failed && <p role="alert" className="text-sm text-red-600">{t("common.error")}</p>}
      {courses.length === 0 && <p className="text-zinc-600">{t("common.none")}</p>}
      <ul className="flex flex-col gap-2">
        {courses.map((c) => (
          <li key={c.id}>
            <Link href={`/admin/courses/${c.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50">
              <span className="font-medium">{loc(c.title, locale)}</span>
              <span className="text-xs text-zinc-500">{c.isPublished ? t("courses.published") : t("courses.draft")}</span>
            </Link>
          </li>
        ))}
      </ul>
      {user.role === "owner" && (
        <form action={createCourseAction} className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white shadow-card p-5">
          <h2 className="text-lg font-extrabold">{t("courses.new")}</h2>
          <label className="flex flex-col gap-1 text-sm">
            {t("field.slug")}
            <input name="slug" required pattern="[a-z0-9\-]{2,60}" className={inputCls} />
          </label>
          <LocFields name="title" label={t("field.title")} />
          <LocFields name="description" label={t("field.description")} multiline requireRu={false} />
          <button type="submit" className={`${btnCls} self-start`}>{t("courses.create")}</button>
        </form>
      )}
    </div>
  );
}
