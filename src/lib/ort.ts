import "server-only";
import { service } from "./db";
import type { Localized } from "./content";

export type SectionKind = "main" | "kyrgyz" | "russian" | "subject";

export type SectionRow = {
  id: string; slug: string; kind: SectionKind; title: Localized; position: number;
  total: number; free: number;
  topics: { id: string; title: Localized; total: number }[];
};

/** Разделы с темами и числом вопросов. Числа не секрет, поэтому читаем серверным подключением. */
export async function listSections(): Promise<SectionRow[]> {
  const sql = service();
  const sections = await sql<{ id: string; slug: string; kind: SectionKind; title: Localized; position: number; total: number; free: number }[]>`
    select s.id, s.slug, s.kind, s.title, s.position,
           count(q.id)::int as total, count(q.id) filter (where q.is_free)::int as free
    from sections s left join questions q on q.section_id = s.id and q.is_published
    where s.is_published group by s.id order by s.position, s.slug`;
  const topics = await sql<{ id: string; section_id: string; title: Localized; total: number }[]>`
    select t.id, t.section_id, t.title, count(q.id)::int as total
    from topics t left join questions q on q.topic_id = t.id and q.is_published
    group by t.id order by t.position`;
  return sections.map((s) => ({
    ...s, topics: topics.filter((t) => t.section_id === s.id).map((t) => ({ id: t.id, title: t.title, total: t.total })),
  }));
}

export async function hasPremium(userId: string): Promise<boolean> {
  const [r] = await service()`
    select 1 from subscriptions where user_id = ${userId} and status = 'active' and expires_at > now() limit 1`;
  return Boolean(r);
}

export async function premiumUntil(userId: string): Promise<Date | null> {
  const [r] = await service()<{ until: Date | null }[]>`
    select max(expires_at) as until from subscriptions where user_id = ${userId} and status = 'active' and expires_at > now()`;
  return r?.until ?? null;
}

export type MockRow = {
  id: string; slug: string; title: Localized; durationMin: number; isFree: boolean; total: number;
};

export async function listMocks(): Promise<MockRow[]> {
  return service()<MockRow[]>`
    select m.id, m.slug, m.title, m.duration_min as "durationMin", m.is_free as "isFree",
           coalesce((select sum(question_count) from mock_test_parts p where p.mock_id = m.id), 0)::int as total
    from mock_tests m where m.is_published order by m.position, m.slug`;
}

const MAX_PRACTICE = 50;

/** Тренировка: случайные вопросы раздела или темы. Без платного доступа берутся только бесплатные. */
export async function startPractice(userId: string, i: { sectionId: string; topicId?: string | null; count: number }) {
  const premium = await hasPremium(userId);
  const count = Math.max(1, Math.min(MAX_PRACTICE, Math.floor(i.count) || 10));
  const sql = service();
  const rows = await sql<{ id: string }[]>`
    select q.id from questions q join sections s on s.id = q.section_id
    where q.section_id = ${i.sectionId} and q.is_published and s.is_published
      and (${i.topicId ?? null}::uuid is null or q.topic_id = ${i.topicId ?? null})
      and (q.is_free or ${premium})
    order by random() limit ${count}`;
  if (rows.length === 0) return null;
  const [a] = await sql<{ id: string }[]>`
    insert into attempts (user_id, kind, section_id, topic_id, question_ids)
    values (${userId}, 'practice', ${i.sectionId}, ${i.topicId ?? null}, ${sql.json(rows.map((r) => r.id))})
    returning id`;
  return a.id;
}

/** Пробный ОРТ: набор вопросов по разделам из состава теста, таймер по длительности. */
export async function startMock(userId: string, mockId: string): Promise<string | { error: "denied" | "empty" }> {
  const sql = service();
  const [m] = await sql<{ id: string; is_free: boolean; duration_min: number }[]>`
    select id, is_free, duration_min from mock_tests where id = ${mockId} and is_published`;
  if (!m) return { error: "empty" };
  const premium = await hasPremium(userId);
  if (!m.is_free && !premium) return { error: "denied" };
  const parts = await sql<{ section_id: string; question_count: number }[]>`
    select section_id, question_count from mock_test_parts where mock_id = ${mockId}`;
  const ids: string[] = [];
  for (const p of parts) {
    const rows = await sql<{ id: string }[]>`
      select id from questions where section_id = ${p.section_id} and is_published
        and (is_free or ${premium} or ${m.is_free}) order by random() limit ${p.question_count}`;
    ids.push(...rows.map((r) => r.id));
  }
  if (ids.length === 0) return { error: "empty" };
  const [a] = await sql<{ id: string }[]>`
    insert into attempts (user_id, kind, mock_id, question_ids, deadline)
    values (${userId}, 'mock', ${mockId}, ${sql.json(ids)}, now() + make_interval(mins => ${m.duration_min}))
    returning id`;
  return a.id;
}

export type AttemptQuestion = {
  id: string; passage: Localized | null; prompt: Localized; options: { id: string; text: Localized }[];
  topicTitle: Localized | null; sectionKind: SectionKind;
};

export type AttemptView = {
  id: string; kind: "practice" | "mock"; status: "in_progress" | "finished"; deadline: Date | null;
  sectionTitle: Localized | null; mockTitle: Localized | null;
  answers: Record<string, string>; correct: number | null; total: number; questions: AttemptQuestion[];
};

/** Попытка с вопросами без правильных ответов. Просмотреть можно только свою. */
export async function getAttempt(userId: string, attemptId: string): Promise<AttemptView | null> {
  if (!/^[0-9a-f-]{36}$/.test(attemptId)) return null;
  const sql = service();
  const [a] = await sql<{ id: string; kind: "practice" | "mock"; status: "in_progress" | "finished"; deadline: Date | null;
    question_ids: string[]; answers: Record<string, string>; correct: number | null;
    section_title: Localized | null; mock_title: Localized | null }[]>`
    select a.id, a.kind, a.status, a.deadline, a.question_ids, a.answers, a.correct,
           s.title as section_title, m.title as mock_title
    from attempts a left join sections s on s.id = a.section_id left join mock_tests m on m.id = a.mock_id
    where a.id = ${attemptId} and a.user_id = ${userId}`;
  if (!a) return null;
  const rows = await sql<(AttemptQuestion & { id: string })[]>`
    select q.id, q.passage, q.prompt, q.options, t.title as "topicTitle", s.kind as "sectionKind"
    from questions q join sections s on s.id = q.section_id left join topics t on t.id = q.topic_id
    where q.id in ${sql(a.question_ids)}`;
  const byId = new Map(rows.map((r) => [r.id, r]));
  const questions = a.question_ids.map((id) => byId.get(id)).filter((q): q is AttemptQuestion => Boolean(q));
  return {
    id: a.id, kind: a.kind, status: a.status, deadline: a.deadline, sectionTitle: a.section_title, mockTitle: a.mock_title,
    answers: a.answers, correct: a.correct, total: a.question_ids.length, questions,
  };
}

export type AnswerResult =
  | { ok: true; correct: boolean | null; correctOption: string | null; explanation: Localized | null }
  | { error: "closed" | "unknown" };

const expired = (deadline: Date | null) => deadline !== null && deadline.getTime() < Date.now();

/**
 * Ответ на вопрос. В тренировке сразу показываем верный вариант и разбор (ответ менять нельзя),
 * в пробном тесте только сохраняем: разбор откроется после завершения.
 */
export async function saveAnswer(userId: string, attemptId: string, questionId: string, optionId: string): Promise<AnswerResult> {
  const sql = service();
  const [a] = await sql<{ kind: "practice" | "mock"; status: string; deadline: Date | null; question_ids: string[]; answers: Record<string, string> }[]>`
    select kind, status, deadline, question_ids, answers from attempts where id = ${attemptId} and user_id = ${userId}`;
  if (!a || !a.question_ids.includes(questionId)) return { error: "unknown" };
  if (a.status !== "in_progress" || expired(a.deadline)) return { error: "closed" };
  const [q] = await sql<{ options: { id: string }[] }[]>`select options from questions where id = ${questionId}`;
  if (!q || !q.options.some((o) => o.id === optionId)) return { error: "unknown" };
  if (a.kind === "practice") {
    if (a.answers[questionId]) return { error: "closed" };
    const [k] = await sql<{ correct_option: string; explanation: Localized }[]>`
      select correct_option, explanation from question_keys where question_id = ${questionId}`;
    await sql`update attempts set answers = answers || ${sql.json({ [questionId]: optionId })} where id = ${attemptId}`;
    return { ok: true, correct: optionId === k?.correct_option, correctOption: k?.correct_option ?? null, explanation: k?.explanation ?? null };
  }
  await sql`update attempts set answers = answers || ${sql.json({ [questionId]: optionId })} where id = ${attemptId}`;
  return { ok: true, correct: null, correctOption: null, explanation: null };
}

/** Завершение: баллы считает сервер по правильным ответам. Повторный вызов ничего не меняет. */
export async function finishAttempt(userId: string, attemptId: string): Promise<boolean> {
  const sql = service();
  const [a] = await sql<{ status: string; question_ids: string[]; answers: Record<string, string> }[]>`
    select status, question_ids, answers from attempts where id = ${attemptId} and user_id = ${userId}`;
  if (!a) return false;
  if (a.status === "finished") return true;
  const keys = await sql<{ question_id: string; correct_option: string }[]>`
    select question_id, correct_option from question_keys where question_id in ${sql(a.question_ids)}`;
  const correct = keys.filter((k) => a.answers[k.question_id] === k.correct_option).length;
  await sql`update attempts set status = 'finished', finished_at = now(), correct = ${correct}, total = ${a.question_ids.length}
            where id = ${attemptId} and status = 'in_progress'`;
  return true;
}

export type ReviewItem = AttemptQuestion & { chosen: string | null; correctOption: string | null; explanation: Localized | null };

/** Разбор завершённой попытки: ответы ученика, верные варианты, пояснения. */
export async function reviewAttempt(userId: string, attemptId: string): Promise<{ attempt: AttemptView; items: ReviewItem[] } | null> {
  const attempt = await getAttempt(userId, attemptId);
  if (!attempt || attempt.status !== "finished") return null;
  const keys = await service()<{ question_id: string; correct_option: string; explanation: Localized }[]>`
    select question_id, correct_option, explanation from question_keys where question_id in ${service()(attempt.questions.map((q) => q.id))}`;
  const kb = new Map(keys.map((k) => [k.question_id, k]));
  return {
    attempt,
    items: attempt.questions.map((q) => ({
      ...q, chosen: attempt.answers[q.id] ?? null,
      correctOption: kb.get(q.id)?.correct_option ?? null, explanation: kb.get(q.id)?.explanation ?? null,
    })),
  };
}

/** Закрывает просроченные пробные тесты ученика (время вышло, а он не нажал «завершить»). */
export async function closeExpired(userId: string) {
  const sql = service();
  const rows = await sql<{ id: string }[]>`
    select id from attempts where user_id = ${userId} and status = 'in_progress' and deadline is not null and deadline < now()`;
  for (const r of rows) await finishAttempt(userId, r.id);
}

export type HistoryRow = {
  id: string; kind: "practice" | "mock"; status: "in_progress" | "finished"; startedAt: Date;
  correct: number | null; total: number | null; sectionTitle: Localized | null; mockTitle: Localized | null;
};

export async function history(userId: string, limit = 30): Promise<HistoryRow[]> {
  return service()<HistoryRow[]>`
    select a.id, a.kind, a.status, a.started_at as "startedAt", a.correct, a.total,
           s.title as "sectionTitle", m.title as "mockTitle"
    from attempts a left join sections s on s.id = a.section_id left join mock_tests m on m.id = a.mock_id
    where a.user_id = ${userId} order by a.started_at desc limit ${limit}`;
}

export type TopicStat = { topicId: string | null; sectionTitle: Localized; topicTitle: Localized | null; answered: number; correct: number };

/** Точность по темам по всем завершённым попыткам: показывает, что подтягивать. */
export async function topicStats(userId: string): Promise<TopicStat[]> {
  return service()<TopicStat[]>`
    with done as (
      select a.answers, jsonb_array_elements_text(a.question_ids) as qid
      from attempts a where a.user_id = ${userId} and a.status = 'finished'
    )
    select q.topic_id as "topicId", s.title as "sectionTitle", t.title as "topicTitle",
           count(*)::int as answered,
           count(*) filter (where d.answers ->> d.qid = k.correct_option)::int as correct
    from done d join questions q on q.id = d.qid::uuid
      join question_keys k on k.question_id = q.id
      join sections s on s.id = q.section_id left join topics t on t.id = q.topic_id
    where d.answers ? d.qid
    group by q.topic_id, s.title, t.title, s.position order by s.position`;
}
