"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { isUiLocale } from "@/i18n/locales";
import { getCurrentUser } from "@/lib/auth";
import { setLessonDone } from "@/lib/cabinet";
import { gradeAssignmentNow } from "@/lib/ai/features";
import { gradeQuiz, submitAssignment, type QuizResult } from "@/lib/exams";

const UUID = /^[0-9a-f-]{36}$/i;

export async function toggleDoneAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const lessonId = String(formData.get("lessonId") ?? "");
  const done = formData.get("done") === "1";
  if (!UUID.test(lessonId)) return;
  try {
    await setLessonDone(user.id, lessonId, done);
  } catch {
    return; // например, урок-экзамен: вручную отметить нельзя
  }
  revalidatePath("/", "layout");
}

/** Одна кнопка: отметить урок пройденным и сразу перейти к следующему (или вернуться к курсу). */
export async function completeAndNextAction(formData: FormData) {
  const user = await getCurrentUser();
  const locale = String(formData.get("locale") ?? "");
  if (!user || !isUiLocale(locale)) return;
  const lessonId = String(formData.get("lessonId") ?? "");
  const nextId = String(formData.get("nextId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!UUID.test(lessonId)) return;
  try {
    await setLessonDone(user.id, lessonId, true);
  } catch {
    return;
  }
  revalidatePath("/", "layout");
  if (UUID.test(nextId)) redirect({ href: `/app/lessons/${nextId}`, locale });
  else if (/^[a-z0-9-]+$/i.test(slug)) redirect({ href: `/app/courses/${slug}`, locale });
}

export type QuizState = QuizResult | null;

export async function submitQuizAction(_: QuizState, fd: FormData): Promise<QuizState> {
  const user = await getCurrentUser();
  const lessonId = String(fd.get("lessonId") ?? "");
  if (!user || !UUID.test(lessonId)) return { error: "denied" };
  const answers: Record<string, string> = {};
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("q_") && typeof v === "string") answers[k.slice(2)] = v;
  }
  const res = await gradeQuiz(user.id, lessonId, answers);
  revalidatePath("/", "layout");
  return res;
}

export type AssignmentState = { ok: boolean } | { error: "empty" | "denied" } | null;

export async function submitAssignmentAction(_: AssignmentState, fd: FormData): Promise<AssignmentState> {
  const user = await getCurrentUser();
  const lessonId = String(fd.get("lessonId") ?? "");
  const text = String(fd.get("text") ?? "");
  if (!user || !UUID.test(lessonId)) return { error: "denied" };
  if (!text.trim()) return { error: "empty" };
  const id = await submitAssignment(user.id, lessonId, text);
  if (!id) return { error: "denied" };
  // Мгновенный разбор от ИИ; если он недоступен, работа остаётся у преподавателя
  const loc = String(fd.get("locale") ?? "");
  await gradeAssignmentNow(user.id, id, isUiLocale(loc) ? loc : "ru").catch(() => false);
  revalidatePath("/", "layout");
  return { ok: true };
}
