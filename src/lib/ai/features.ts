import "server-only";
import { service } from "../db";
import { ask, cached, GROUND_RULES } from ".";
import { loc, type Localized } from "../content";

export type ExplainOut = { text: string; mock: boolean } | { error: "limit" | "error" | "unavailable" | "denied" };

/**
 * Разбор ошибки: почему верный вариант правильный и чем неверен выбор ученика.
 * Доступно только по своей завершённой попытке. Ответ кэшируется на всех (вопрос + выбор + язык).
 */
export async function explainMistake(userId: string, attemptId: string, questionId: string, locale: string): Promise<ExplainOut> {
  const sql = service();
  const [a] = await sql<{ answers: Record<string, string>; question_ids: string[] }[]>`
    select answers, question_ids from attempts where id = ${attemptId} and user_id = ${userId} and status = 'finished'`;
  if (!a || !a.question_ids.includes(questionId)) return { error: "denied" };
  const chosen = a.answers[questionId] ?? null;
  const [q] = await sql<{ prompt: Localized; passage: Localized | null; options: { id: string; text: Localized }[];
    correct_option: string; explanation: Localized }[]>`
    select q.prompt, q.passage, q.options, k.correct_option, k.explanation
    from questions q join question_keys k on k.question_id = q.id where q.id = ${questionId}`;
  if (!q) return { error: "denied" };
  const optText = (id: string | null) => (id ? loc(q.options.find((o) => o.id === id)?.text, locale) : "—");
  let mock = false;
  const value = await cached<string>(`explain:${questionId}:${chosen ?? "none"}:${locale}`, async () => {
    const r = await ask({
      feature: "explain", userId,
      system: GROUND_RULES(locale),
      messages: [{ role: "user", content:
        `Вопрос: ${loc(q.prompt, locale)}\n${q.passage ? `Текст: ${loc(q.passage, locale)}\n` : ""}Варианты:\n` +
        q.options.map((o) => `${o.id}) ${loc(o.text, locale)}`).join("\n") +
        `\nПравильный ответ: ${q.correct_option}) ${optText(q.correct_option)}\n` +
        `Ответ ученика: ${chosen ? `${chosen}) ${optText(chosen)}` : "не отвечал"}\n` +
        (loc(q.explanation, locale) ? `Пояснение автора вопроса: ${loc(q.explanation, locale)}\n` : "") +
        `Объясни коротко (3–5 предложений): почему правильный ответ верный и в чём ошибка ученика.` }],
      maxTokens: 400,
    });
    if (!r.ok) throw new Error(r.reason);
    mock = r.mock;
    return { value: r.text, cache: !r.mock };
  }).catch((e: Error) => (e.message === "limit" || e.message === "unavailable" ? e.message : "error"));
  if (value === "limit" || value === "unavailable" || value === "error" || value === null) return { error: value === null ? "error" : value };
  return { text: value, mock };
}
