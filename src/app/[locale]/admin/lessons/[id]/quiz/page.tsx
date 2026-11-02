import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocFields, btnCls, btnGhostCls, inputCls } from "@/components/loc-fields";
import { loc, type Localized } from "@/lib/content";
import { getLessonEdit } from "@/lib/admin";
import { withUser } from "@/lib/db";
import { requireRole } from "@/lib/guards";
import { addQuestionAction, deleteQuestionAction } from "../../../actions";
import { quizGenAction } from "../../../ai-actions";

export default async function QuizEditPage({ params, searchParams }: PageProps<"/[locale]/admin/lessons/[id]/quiz">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireRole(locale, ["owner", "teacher"]);
  const lesson = await getLessonEdit(user.id, id);
  if (!lesson || lesson.exam !== "quiz") notFound();
  const t = await getTranslations("Admin");
  const failed = (await searchParams).error;
  const questions = await withUser(user.id, (tx) => tx<
    { id: string; prompt: Localized; options: { id: string; text: Localized }[]; correct: string }[]>`
    select id, prompt, options, correct_option as correct from quiz_questions where lesson_id = ${id} order by position`);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Link href={`/admin/lessons/${id}`} className="text-sm text-zinc-600 underline">{t("common.back")}</Link>
      <h1 className="text-2xl font-extrabold">{t("lesson.questions")}</h1>
      {failed && <p role="alert" className="text-sm text-red-600">{t("common.error")}</p>}
      {questions.length === 0 && <p className="text-zinc-600">{t("quiz.empty")}</p>}
      <ol className="flex flex-col gap-3">
        {questions.map((q, i) => (
          <li key={q.id} className="rounded-3xl border border-zinc-200 bg-white shadow-card p-4">
            <p className="font-medium">{i + 1}. {loc(q.prompt, locale)}</p>
            <ul className="mt-2 text-sm">
              {q.options.map((o) => (
                <li key={o.id} className={o.id === q.correct ? "font-medium text-emerald-700" : "text-zinc-600"}>
                  {o.id === q.correct ? "✓ " : "· "}{loc(o.text, locale)}
                </li>
              ))}
            </ul>
            <form action={deleteQuestionAction} className="mt-3">
              <input type="hidden" name="id" value={q.id} />
              <input type="hidden" name="lessonId" value={id} />
              <button type="submit" className={btnGhostCls}>{t("common.delete")}</button>
            </form>
          </li>
        ))}
      </ol>
      <form action={quizGenAction}>
        <input type="hidden" name="lessonId" value={id} />
        <button type="submit" className={btnGhostCls}>{t("ai.quizGen")}</button>
      </form>
      <form action={addQuestionAction} className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white shadow-card p-5">
        <input type="hidden" name="lessonId" value={id} />
        <LocFields name="prompt" label={t("quiz.prompt")} />
        <LocFields name="options" label={t("quiz.options")} multiline />
        <p className="text-xs text-zinc-500">{t("quiz.optionsHint")}</p>
        <label className="flex flex-col gap-1 text-sm">
          {t("quiz.correct")}
          <input name="correct" type="number" min={1} max={8} required className={inputCls} />
        </label>
        <button type="submit" className={`${btnCls} self-start`}>{t("quiz.add")}</button>
      </form>
    </div>
  );
}
