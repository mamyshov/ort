import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { loc } from "@/lib/content";
import { requireUser } from "@/lib/guards";
import { closeExpired, getAttempt } from "@/lib/ort";
import { service } from "@/lib/db";
import { Runner, type RQuestion } from "./runner";

export default async function AttemptPage({ params }: PageProps<"/[locale]/app/attempt/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  await closeExpired(user.id);
  const a = await getAttempt(user.id, id);
  if (!a) notFound();
  if (a.status === "finished") return redirect({ href: `/app/results/${id}`, locale });
  const questions: RQuestion[] = a.questions.map((q) => ({
    id: q.id, passage: loc(q.passage, locale), prompt: loc(q.prompt, locale), topic: loc(q.topicTitle, locale),
    options: q.options.map((o) => ({ id: o.id, text: loc(o.text, locale) })),
  }));
  // В тренировке уже отвеченные вопросы показываем с разбором (после перезагрузки страницы)
  const feedback: Record<string, { correct: boolean; correctOption: string | null; explanation: string }> = {};
  if (a.kind === "practice" && Object.keys(a.answers).length) {
    const keys = await service()<{ question_id: string; correct_option: string; explanation: Record<string, string> }[]>`
      select question_id, correct_option, explanation from question_keys where question_id in ${service()(Object.keys(a.answers))}`;
    for (const k of keys) feedback[k.question_id] = { correct: a.answers[k.question_id] === k.correct_option, correctOption: k.correct_option, explanation: loc(k.explanation, locale) };
  }
  return (
    <Runner attemptId={a.id} kind={a.kind} questions={questions} initial={a.answers}
      deadline={a.deadline ? a.deadline.getTime() : null} feedback={feedback} />
  );
}
