import "server-only";
import { randomBytes } from "node:crypto";
import { service, withUser } from "./db";
import type { Localized } from "./content";

export const DEFAULT_PASS_SCORE = 70;
export const ASSIGNMENT_PASS_SCORE = 50;

export type QuizQuestion = {
  id: string;
  prompt: Localized;
  options: { id: string; text: Localized }[];
};

/** Вопросы теста без правильных ответов. Доступ проверяет база: нужен доступ к курсу урока. */
export async function getQuiz(userId: string, lessonId: string) {
  const allowed = await withUser(userId, async (tx) => {
    const [r] = await tx<{ ok: boolean; pass: number | null }[]>`
      select has_course_access(lesson_course_id(l.id)) as ok, l.pass_score as pass
      from lessons l where l.id = ${lessonId} and l.kind = 'exam' and l.exam = 'quiz'`;
    return r?.ok ? r : null;
  });
  if (!allowed) return null;
  const questions = await service()<QuizQuestion[]>`
    select id, prompt, options from quiz_questions where lesson_id = ${lessonId} order by position`;
  return { questions, passScore: allowed.pass ?? DEFAULT_PASS_SCORE };
}

export type QuizResult = { score: number; passed: boolean; passScore: number } | { error: "unanswered" | "denied" };

/** Проверка теста целиком на сервере. Баллы пишет сервер, ученик их задать не может. */
export async function gradeQuiz(userId: string, lessonId: string, answers: Record<string, string>): Promise<QuizResult> {
  const quiz = await getQuiz(userId, lessonId);
  if (!quiz) return { error: "denied" };
  const sql = service();
  const keys = await sql<{ id: string; correct_option: string }[]>`
    select id, correct_option from quiz_questions where lesson_id = ${lessonId}`;
  if (keys.length === 0 || keys.some((k) => !answers[k.id])) return { error: "unanswered" };
  const right = keys.filter((k) => answers[k.id] === k.correct_option).length;
  const score = Math.round((right / keys.length) * 100);
  const passed = score >= quiz.passScore;
  await sql`
    insert into exam_submissions (user_id, lesson_id, answers, auto_score, status, reviewed_at)
    values (${userId}, ${lessonId}, ${sql.json(answers)}, ${score}, 'reviewed', now())`;
  if (passed) await markDone(userId, lessonId);
  return { score, passed, passScore: quiz.passScore };
}

/** Отметка «пройдено» для экзамена: только сервер, после проверки. */
export async function markDone(userId: string, lessonId: string) {
  await service()`
    insert into lesson_progress (user_id, lesson_id) values (${userId}, ${lessonId}) on conflict do nothing`;
}

export type MySubmission = {
  id: string; status: "pending" | "reviewed"; teacherScore: number | null; autoScore: number | null;
  feedback: string | null; answers: { text?: string }; createdAt: Date; byAi: boolean;
};

export const lastSubmission = (userId: string, lessonId: string) =>
  withUser(userId, async (tx) => {
    const [r] = await tx<MySubmission[]>`
      select id, status, teacher_score::float as "teacherScore", auto_score::float as "autoScore",
             feedback, answers, created_at as "createdAt",
             (ai_draft is not null and reviewed_by is null and status = 'reviewed') as "byAi"
      from exam_submissions where user_id = ${userId} and lesson_id = ${lessonId}
      order by created_at desc limit 1`;
    return r ?? null;
  });

/** Сдача задания: запись идёт от имени ученика, правила базы не дают ему поставить оценку. */
export async function submitAssignment(userId: string, lessonId: string, text: string): Promise<string | null> {
  const t = text.trim().slice(0, 10000);
  if (!t) return null;
  try {
    return await withUser(userId, async (tx) => {
      const [l] = await tx<{ ok: boolean }[]>`
        select true as ok from lessons where id = ${lessonId} and kind = 'exam' and exam = 'assignment'`;
      if (!l) throw new Error("not an assignment");
      const [row] = await tx<{ id: string }[]>`
        insert into exam_submissions (user_id, lesson_id, answers)
        values (${userId}, ${lessonId}, ${tx.json({ text: t })}) returning id`;
      return row.id;
    });
  } catch {
    return null;
  }
}

export type ReviewRow = {
  id: string; student: string; studentId: string; lessonId: string; lessonTitle: Localized; courseTitle: Localized;
  prompt: Localized | null; text: string; createdAt: Date; aiDraft: { score?: number; comment?: string } | null;
};

/** Очередь работ. Кто что видит, решает база: владелец все, преподаватель только свои курсы. */
export const pendingReviews = (staffId: string) =>
  withUser(staffId, (tx) => tx<ReviewRow[]>`
    select s.id, coalesce(p.full_name, p.email) as student, s.user_id as "studentId",
           l.id as "lessonId", l.title as "lessonTitle", c.title as "courseTitle",
           l.content -> 'prompt' as prompt, coalesce(s.answers ->> 'text', '') as text,
           s.created_at as "createdAt", s.ai_draft as "aiDraft"
    from exam_submissions s
    join lessons l on l.id = s.lesson_id and l.exam = 'assignment'
    join modules m on m.id = l.module_id join courses c on c.id = m.course_id
    join profiles p on p.id = s.user_id
    where s.status = 'pending' order by s.created_at`);

export async function reviewSubmission(
  staffId: string, submissionId: string, score: number, feedback: string,
): Promise<boolean> {
  if (!Number.isFinite(score) || score < 0 || score > 100) return false;
  const reviewed = await withUser(staffId, async (tx) => {
    const r = await tx<{ user_id: string; lesson_id: string }[]>`
      update exam_submissions set teacher_score = ${score}, feedback = ${feedback.trim().slice(0, 5000) || null},
             status = 'reviewed', reviewed_by = ${staffId}, reviewed_at = now()
      where id = ${submissionId} and status = 'pending' returning user_id, lesson_id`;
    if (r.length === 0) return null;
    await tx`insert into audit_log (actor_id, action, entity, entity_id, data)
             values (${staffId}, 'submission.review', 'submission', ${submissionId}, ${tx.json({ score })})`;
    return r[0];
  });
  if (!reviewed) return false;
  if (score >= ASSIGNMENT_PASS_SCORE) await markDone(reviewed.user_id, reviewed.lesson_id);
  return true;
}

// ---------- Сертификаты ----------

const ELIGIBLE = `
  e.status = 'active'
  and exists (select 1 from lessons l join modules m on m.id = l.module_id where m.course_id = e.course_id)
  and not exists (
    select 1 from lessons l join modules m on m.id = l.module_id
    where m.course_id = e.course_id
      and not exists (select 1 from lesson_progress lp where lp.lesson_id = l.id and lp.user_id = e.user_id))`;

export type CertCandidate = { userId: string; courseId: string; student: string; courseTitle: Localized };

export const certificateCandidates = (staffId: string) =>
  withUser(staffId, (tx) => tx.unsafe<CertCandidate[]>(`
    select e.user_id as "userId", e.course_id as "courseId",
           coalesce(p.full_name, p.email) as student, c.title as "courseTitle"
    from enrollments e join profiles p on p.id = e.user_id join courses c on c.id = e.course_id
    where ${ELIGIBLE}
      and not exists (select 1 from certificates x where x.user_id = e.user_id and x.course_id = e.course_id)
    order by e.granted_at`));

export type IssuedCert = { number: string; student: string; courseTitle: Localized; issuedAt: Date };

export const issuedCertificates = (staffId: string) =>
  withUser(staffId, (tx) => tx<IssuedCert[]>`
    select x.number, coalesce(p.full_name, p.email) as student, c.title as "courseTitle", x.issued_at as "issuedAt"
    from certificates x join profiles p on p.id = x.user_id join courses c on c.id = x.course_id
    order by x.issued_at desc limit 100`);

function newCertNumber() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  const code = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `DAS-${new Date().getFullYear()}-${code}`;
}

/** Выдаёт сертификат, если курс действительно пройден целиком. Повторно проверяет это в базе. */
export async function issueCertificate(staffId: string, userId: string, courseId: string): Promise<boolean> {
  try {
    return await withUser(staffId, async (tx) => {
      const ok = await tx.unsafe<{ x: number }[]>(
        `select 1 as x from enrollments e where e.user_id = $1 and e.course_id = $2 and ${ELIGIBLE}`, [userId, courseId]);
      if (ok.length === 0) return false;
      const number = newCertNumber();
      await tx`insert into certificates (user_id, course_id, number, issued_by)
               values (${userId}, ${courseId}, ${number}, ${staffId}) on conflict do nothing`;
      await tx`insert into audit_log (actor_id, action, entity, entity_id, data)
               values (${staffId}, 'certificate.issue', 'certificate', ${number}, ${tx.json({ userId, courseId })})`;
      return true;
    });
  } catch {
    return false;
  }
}

export const myCertificates = (userId: string) =>
  withUser(userId, (tx) => tx<{ courseId: string; number: string }[]>`
    select course_id as "courseId", number from certificates where user_id = ${userId}`);

/** Публичная проверка по номеру. Отдаёт только имя, курс и дату. */
export async function verifyCertificate(number: string) {
  if (!/^[A-Z0-9-]{6,40}$/.test(number)) return null;
  const [r] = await service()<{ name: string; courseTitle: Localized; issuedAt: Date; number: string }[]>`
    select coalesce(p.full_name, split_part(p.email, '@', 1)) as name, c.title as "courseTitle",
           x.issued_at as "issuedAt", x.number
    from certificates x join profiles p on p.id = x.user_id join courses c on c.id = x.course_id
    where x.number = ${number}`;
  return r ?? null;
}
