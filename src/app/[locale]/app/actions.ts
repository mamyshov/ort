"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import { finishAttempt, saveAnswer, startMock, startPractice, type AnswerResult } from "@/lib/ort";
import { explainMistake, type ExplainOut } from "@/lib/ai/features";
import { tooMany } from "@/lib/ratelimit";

export async function startPracticeAction(fd: FormData) {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) return redirect({ href: "/login", locale });
  const sectionId = String(fd.get("sectionId") ?? "");
  const topic = String(fd.get("topicId") ?? "");
  const id = /^[0-9a-f-]{36}$/.test(sectionId)
    ? await startPractice(user.id, { sectionId, topicId: /^[0-9a-f-]{36}$/.test(topic) ? topic : null, count: Number(fd.get("count")) })
    : null;
  return redirect({ href: id ? `/app/attempt/${id}` : "/app/practice?empty=1", locale });
}

export async function startMockAction(fd: FormData) {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) return redirect({ href: "/login", locale });
  const res = await startMock(user.id, String(fd.get("mockId") ?? ""));
  if (typeof res === "string") return redirect({ href: `/app/attempt/${res}`, locale });
  return redirect({ href: res.error === "denied" ? "/pricing" : "/app/mock?empty=1", locale });
}

export async function answerAction(attemptId: string, questionId: string, optionId: string): Promise<AnswerResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "closed" };
  return saveAnswer(user.id, attemptId, questionId, optionId);
}

export async function finishAction(attemptId: string) {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) return redirect({ href: "/login", locale });
  await finishAttempt(user.id, attemptId);
  return redirect({ href: `/app/results/${attemptId}`, locale });
}

export async function explainAction(attemptId: string, questionId: string): Promise<ExplainOut> {
  const user = await getCurrentUser();
  if (!user) return { error: "denied" };
  if (await tooMany("explain", 40)) return { error: "limit" };
  return explainMistake(user.id, attemptId, questionId, await getLocale());
}
