import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocFields, btnCls, btnGhostCls, inputCls } from "@/components/loc-fields";
import { getLessonEdit } from "@/lib/admin";
import { requireRole } from "@/lib/guards";
import { deleteLessonAction, updateLessonAction } from "../../actions";
import { translateAction } from "../../ai-actions";

export default async function LessonEditPage({ params, searchParams }: PageProps<"/[locale]/admin/lessons/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireRole(locale, ["owner", "manager", "teacher"]);
  const l = await getLessonEdit(user.id, id);
  if (!l) notFound();
  const t = await getTranslations("Admin");
  const failed = (await searchParams).error;
  const label = "flex flex-col gap-1 text-sm";

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Link href={`/admin/courses/${l.courseId}`} className="text-sm text-zinc-600 underline">{t("common.back")}</Link>
      <h1 className="text-2xl font-extrabold">{t("lesson.edit")}</h1>
      {failed && <p role="alert" className="text-sm text-red-600">{t("common.error")}</p>}
      <form action={updateLessonAction} className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white shadow-card p-5">
        <input type="hidden" name="id" value={l.id} />
        <LocFields name="title" label={t("field.title")} value={l.title} />
        <label className={label}>
          {t("lesson.kindLabel")}
          <select name="kind" defaultValue={l.kind} className={inputCls}>
            {(["video", "text", "exam"] as const).map((k) => <option key={k} value={k}>{t(`lesson.kinds.${k}`)}</option>)}
          </select>
        </label>
        <label className={label}>
          {t("lesson.provider")}
          <select name="provider" defaultValue={l.provider ?? ""} className={inputCls}>
            <option value="">{t("lesson.noProvider")}</option>
            {["bunny", "youtube", "vimeo"].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className={label}>
          {t("lesson.videoRef")}
          <input name="videoRef" defaultValue={l.videoRef ?? ""} className={inputCls} />
        </label>
        <label className={label}>
          {t("lesson.examLabel")}
          <select name="exam" defaultValue={l.exam ?? "quiz"} className={inputCls}>
            {(["quiz", "assignment"] as const).map((k) => <option key={k} value={k}>{t(`lesson.exams.${k}`)}</option>)}
          </select>
        </label>
        <label className={label}>
          {t("lesson.passScore")}
          <input name="passScore" type="number" min={0} max={100} defaultValue={l.passScore ?? ""} className={inputCls} />
        </label>
        <LocFields name="body" label={t("lesson.body")} value={l.content.body} multiline requireRu={false} />
        <LocFields name="prompt" label={t("lesson.prompt")} value={l.content.prompt} multiline requireRu={false} />
        <button type="submit" className={`${btnCls} self-start`}>{t("common.save")}</button>
      </form>
      <form action={translateAction} className="flex flex-col gap-1">
        <input type="hidden" name="id" value={l.id} />
        <button type="submit" className={`${btnGhostCls} self-start`}>{t("ai.translate")}</button>
        <p className="text-xs text-amber-700">{t("ai.translateWarn")}</p>
      </form>
      {l.exam === "quiz" && (
        <Link href={`/admin/lessons/${l.id}/quiz`} className={`${btnGhostCls} self-start`}>{t("lesson.questions")}</Link>
      )}
      <form action={deleteLessonAction}>
        <input type="hidden" name="id" value={l.id} />
        <input type="hidden" name="courseId" value={l.courseId} />
        <button type="submit" className={`${btnGhostCls} text-red-700`}>{t("common.delete")}</button>
      </form>
    </div>
  );
}
