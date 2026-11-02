import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocFields, btnCls, btnGhostCls, inputCls } from "@/components/loc-fields";
import { loc } from "@/lib/content";
import { getCourseEdit, listTeachers } from "@/lib/admin";
import { requireRole } from "@/lib/guards";
import { addLessonAction, addModuleAction, assignTeacherAction, updateCourseAction } from "../../actions";

export default async function CourseEditPage({ params, searchParams }: PageProps<"/[locale]/admin/courses/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireRole(locale, ["owner", "manager", "teacher"]);
  const course = await getCourseEdit(user.id, id);
  if (!course) notFound();
  const t = await getTranslations("Admin");
  const failed = (await searchParams).error;
  const canEdit = user.role === "owner" || (user.role === "teacher" && course.teachers.some((x) => x.id === user.id));
  const teachers = user.role === "owner" ? await listTeachers(user.id) : [];
  const free = teachers.filter((x) => !course.teachers.some((c) => c.id === x.id));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/admin/courses" className="text-sm text-zinc-600 underline">{t("common.back")}</Link>
        <h1 className="mt-2 text-2xl font-extrabold">{loc(course.title, locale)}</h1>
      </div>
      {failed && <p role="alert" className="text-sm text-red-600">{t("common.error")}</p>}

      {canEdit ? (
        <form action={updateCourseAction} className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white shadow-card p-5">
          <h2 className="text-lg font-extrabold">{t("courses.settings")}</h2>
          <input type="hidden" name="id" value={course.id} />
          <LocFields name="title" label={t("field.title")} value={course.title} />
          <LocFields name="description" label={t("field.description")} value={course.description} multiline requireRu={false} />
          <label className="flex flex-col gap-1 text-sm">{t("courses.audience")}
            <select name="audience" defaultValue={course.audience ?? "all"} className="rounded-lg border border-zinc-300 px-3 py-2 text-base">
              {(["all", "kids", "teens", "adults"] as const).map((a) => <option key={a} value={a}>{t(`courses.aud.${a}`)}</option>)}
            </select></label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="published" defaultChecked={course.isPublished} />
            {t("courses.publish")}
          </label>
          <button type="submit" className={`${btnCls} self-start`}>{t("common.save")}</button>
        </form>
      ) : (
        <p className="text-sm text-zinc-600">{course.isPublished ? t("courses.published") : t("courses.draft")}</p>
      )}

      <section className="flex flex-col gap-3 rounded-3xl border border-zinc-200 bg-white shadow-card p-5">
        <h2 className="text-lg font-extrabold">{t("courses.teachers")}</h2>
        {course.teachers.length === 0 && <p className="text-sm text-zinc-500">{t("common.none")}</p>}
        <ul className="flex flex-col gap-2">
          {course.teachers.map((x) => (
            <li key={x.id} className="flex items-center justify-between gap-3">
              <span>{x.name}</span>
              {user.role === "owner" && (
                <form action={assignTeacherAction}>
                  <input type="hidden" name="courseId" value={course.id} />
                  <input type="hidden" name="teacherId" value={x.id} />
                  <input type="hidden" name="remove" value="1" />
                  <button type="submit" className={btnGhostCls}>{t("common.delete")}</button>
                </form>
              )}
            </li>
          ))}
        </ul>
        {user.role === "owner" && free.length > 0 && (
          <form action={assignTeacherAction} className="flex gap-2">
            <input type="hidden" name="courseId" value={course.id} />
            <select name="teacherId" className={inputCls} aria-label={t("courses.addTeacher")}>
              {free.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <button type="submit" className={btnCls}>{t("courses.addTeacher")}</button>
          </form>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-extrabold">{t("courses.modules")}</h2>
        {course.modules.map((m) => (
          <div key={m.id} className="rounded-3xl border border-zinc-200 bg-white shadow-card p-5">
            <h3 className="font-extrabold">{loc(m.title, locale)}</h3>
            <ul className="mt-2 flex flex-col">
              {m.lessons.map((l) => (
                <li key={l.id}>
                  <Link href={`/admin/lessons/${l.id}`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-zinc-50">
                    <span>{loc(l.title, locale)}</span>
                    <span className="text-xs text-zinc-500">{t(`lesson.kinds.${l.kind as "video" | "text" | "exam"}`)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {canEdit && (
              <form action={addLessonAction} className="mt-3 flex flex-col gap-2 border-t border-zinc-100 pt-3">
                <input type="hidden" name="moduleId" value={m.id} />
                <input type="hidden" name="courseId" value={course.id} />
                <LocFields name="title" label={t("courses.lessonTitle")} />
                <button type="submit" className={`${btnGhostCls} self-start`}>{t("courses.addLesson")}</button>
              </form>
            )}
          </div>
        ))}
        {canEdit && (
          <form action={addModuleAction} className="flex flex-col gap-3 rounded-2xl border border-dashed border-zinc-300 p-5">
            <input type="hidden" name="courseId" value={course.id} />
            <LocFields name="title" label={t("courses.moduleTitle")} />
            <button type="submit" className={`${btnCls} self-start`}>{t("courses.addModule")}</button>
          </form>
        )}
      </section>
    </div>
  );
}
