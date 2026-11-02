import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AiChat } from "@/components/ai-chat";
import { Flashcards } from "@/components/flashcards";
import { lessonChatAction } from "../../../ai/actions";
import { VideoPlayer } from "@/components/video-player";
import { loc } from "@/lib/content";
import { getLesson } from "@/lib/cabinet";
import { requireUser } from "@/lib/guards";
import { ASSIGNMENT_PASS_SCORE, getQuiz, lastSubmission } from "@/lib/exams";
import { gradeAssignmentNow } from "@/lib/ai/features";
import { completeAndNextAction, toggleDoneAction } from "./actions";
import { AssignmentForm } from "./assignment-form";
import { QuizForm } from "./quiz-form";

// Проверка задания ИИ может занять несколько секунд: даём серверу время (действует и на отправку задания)
export const maxDuration = 60;

export default async function LessonPage({ params }: PageProps<"/[locale]/app/lessons/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const lesson = await getLesson(user.id, id);
  if (!lesson) notFound();
  const t = await getTranslations("App.lesson");
  const title = loc(lesson.title, locale);
  const body = loc(lesson.content.body, locale);
  const prompt = loc(lesson.content.prompt, locale);
  const te = await getTranslations("App.exam");
  const ta = await getTranslations("Ai");
  const quiz = lesson.exam === "quiz" ? await getQuiz(user.id, lesson.id) : null;
  let sub = lesson.exam === "assignment" ? await lastSubmission(user.id, lesson.id) : null;
  if (sub?.status === "pending" && await gradeAssignmentNow(user.id, sub.id, locale).catch(() => false)) {
    sub = await lastSubmission(user.id, lesson.id); // работа ждала проверки: ИИ разобрал её при открытии урока
  }

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div>
        <Link href={`/app/courses/${lesson.courseSlug}`} className="text-sm text-zinc-600 underline">
          {t("back")}: {loc(lesson.courseTitle, locale)}
        </Link>
        <p className="mt-3 text-sm text-zinc-500">{loc(lesson.moduleTitle, locale)}</p>
        <h1 className="text-2xl font-extrabold">{title}</h1>
      </div>

      {lesson.kind === "video" && (
        <VideoPlayer
          provider={lesson.videoProvider}
          videoRef={lesson.videoRef}
          title={title}
          fallback={t("noVideo")}
        />
      )}
      {(body || prompt) && (
        <div className="whitespace-pre-line rounded-3xl border border-zinc-200 bg-white shadow-card p-5 leading-relaxed">
          {body || prompt}
        </div>
      )}

      {quiz && (
        quiz.questions.length === 0 ? <p className="text-zinc-600">{te("noQuestions")}</p> : (
          <QuizForm
            lessonId={lesson.id}
            questions={quiz.questions.map((q) => ({
              id: q.id,
              prompt: loc(q.prompt, locale),
              options: q.options.map((o) => ({ id: o.id, text: loc(o.text, locale) })),
            }))}
          />
        )
      )}
      {lesson.exam === "assignment" && (
        <>
          {sub && (
            <div className="rounded-3xl border border-zinc-200 bg-white shadow-card p-5 text-sm">
              {sub.status === "pending" ? (
                <p>{te("pending")}</p>
              ) : (
                <>
                  <p className="font-medium">{te("reviewed", { score: Math.round(sub.teacherScore ?? 0) })}</p>
                  {sub.feedback && <p className="mt-2 whitespace-pre-line"><span className="text-zinc-500">{sub.byAi ? te("feedbackAi") : te("feedback")}: </span>{sub.feedback}</p>}
                  {(sub.teacherScore ?? 0) < ASSIGNMENT_PASS_SCORE && <p className="mt-2 font-bold text-amber-800">{te("belowPass", { pass: ASSIGNMENT_PASS_SCORE })}</p>}
                </>
              )}
            </div>
          )}
          {(!sub || sub.status === "reviewed") && <AssignmentForm lessonId={lesson.id} resubmit={!!sub} />}
        </>
      )}

      {lesson.kind !== "exam" && (
        <details className="group rounded-3xl border border-zinc-200 bg-white p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between font-extrabold [&::-webkit-details-marker]:hidden">
            {t("help")}
            <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-brand transition-transform group-open:rotate-45">+</span>
          </summary>
          <div className="mt-4 flex flex-col gap-4">
            <AiChat action={lessonChatAction} title={ta("lesson.title")} placeholder={ta("lesson.placeholder")} extra={{ lessonId: lesson.id }} />
            <Flashcards lessonId={lesson.id} />
          </div>
        </details>
      )}

      <div className="sticky bottom-[4.5rem] z-10 -mx-4 flex flex-col gap-2 bg-gradient-to-t from-zinc-50 from-70% to-transparent px-4 pb-1 pt-6 md:static md:mx-0 md:bg-none md:px-0 md:pt-2">
        {lesson.kind === "exam" ? (
          lesson.done && <p className="text-center font-bold text-emerald-700">✓ {t("done")}</p>
        ) : (
          <form action={completeAndNextAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="lessonId" value={lesson.id} />
            <input type="hidden" name="nextId" value={lesson.nextId ?? ""} />
            <input type="hidden" name="slug" value={lesson.courseSlug} />
            <button type="submit" className="btn-primary w-full px-5 py-4 text-lg">
              {lesson.nextId ? t("doneNext") : t("doneBack")} →
            </button>
          </form>
        )}
        <div className="flex items-center justify-between gap-3 text-sm">
          {lesson.prevId ? <Link href={`/app/lessons/${lesson.prevId}`} className="font-bold text-zinc-600 hover:text-brand">← {t("prev")}</Link> : <span />}
          {lesson.kind !== "exam" && lesson.done && (
            <form action={toggleDoneAction}>
              <input type="hidden" name="lessonId" value={lesson.id} />
              <input type="hidden" name="done" value="0" />
              <button type="submit" className="font-bold text-zinc-500 hover:text-brand">{t("unmark")}</button>
            </form>
          )}
          {lesson.nextId && (lesson.kind === "exam" || lesson.done) ? <Link href={`/app/lessons/${lesson.nextId}`} className="font-bold text-brand">{t("next")} →</Link> : <span />}
        </div>
      </div>
    </article>
  );
}
