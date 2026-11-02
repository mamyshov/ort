import "server-only";
import { withUser } from "./db";
import type { Localized } from "./content";

export type ProgressRow = {
  studentId: string; name: string; email: string; courseId: string; courseTitle: Localized;
  total: number; done: number; examsPassed: number; examsFailed: number; examsPending: number; lastActivity: Date | null;
};

/**
 * Успеваемость: ученик × курс. Кто что видит, решает база (RLS): преподаватель только учеников своих курсов,
 * менеджер видит пройденные уроки, но не работы и тесты, владелец всё.
 */
export const listProgress = (uid: string, courseId: string | null) =>
  withUser(uid, (tx) => tx<ProgressRow[]>`
    select e.user_id as "studentId", coalesce(p.full_name, '') as name, p.email,
           c.id as "courseId", c.title as "courseTitle",
           (select count(*)::int from lessons l join modules m on m.id = l.module_id where m.course_id = c.id) as total,
           (select count(*)::int from lesson_progress lp join lessons l on l.id = lp.lesson_id join modules m on m.id = l.module_id
             where m.course_id = c.id and lp.user_id = e.user_id) as done,
           (select count(*)::int from lessons l join modules m on m.id = l.module_id
             where m.course_id = c.id and l.kind = 'exam'
               and exists (select 1 from lesson_progress lp where lp.lesson_id = l.id and lp.user_id = e.user_id)) as "examsPassed",
           (select count(*)::int from lessons l join modules m on m.id = l.module_id
             where m.course_id = c.id and l.kind = 'exam'
               and not exists (select 1 from lesson_progress lp where lp.lesson_id = l.id and lp.user_id = e.user_id)
               and exists (select 1 from exam_submissions s where s.lesson_id = l.id and s.user_id = e.user_id and s.status = 'reviewed')) as "examsFailed",
           (select count(*)::int from lessons l join modules m on m.id = l.module_id
             where m.course_id = c.id and l.kind = 'exam'
               and exists (select 1 from exam_submissions s where s.lesson_id = l.id and s.user_id = e.user_id and s.status = 'pending')) as "examsPending",
           greatest(
             (select max(lp.completed_at) from lesson_progress lp join lessons l on l.id = lp.lesson_id join modules m on m.id = l.module_id
               where m.course_id = c.id and lp.user_id = e.user_id),
             (select max(s.created_at) from exam_submissions s join lessons l on l.id = s.lesson_id join modules m on m.id = l.module_id
               where m.course_id = c.id and s.user_id = e.user_id)) as "lastActivity"
    from enrollments e
    join profiles p on p.id = e.user_id
    join courses c on c.id = e.course_id
    where e.status = 'active' and (${courseId}::uuid is null or c.id = ${courseId}::uuid)
    order by "lastActivity" desc nulls last, p.created_at desc
    limit 300`);

export type Attempt = {
  id: string; at: Date; status: "pending" | "reviewed"; score: number | null; passed: boolean | null;
  feedback: string | null; text: string | null; byAi: boolean;
};
export type LessonProgress = {
  id: string; title: Localized; moduleTitle: Localized; kind: "video" | "text" | "exam"; exam: "quiz" | "assignment" | null;
  doneAt: Date | null; attempts: Attempt[];
};
export type StudentProgress = {
  studentId: string; name: string; email: string; courseTitle: Localized; lessons: LessonProgress[];
};

export async function getStudentProgress(uid: string, studentId: string, courseId: string): Promise<StudentProgress | null> {
  const uuid = /^[0-9a-f-]{36}$/i;
  if (!uuid.test(studentId) || !uuid.test(courseId)) return null;
  return withUser(uid, async (tx) => {
    const [h] = await tx<{ name: string; email: string; title: Localized }[]>`
      select coalesce(p.full_name, '') as name, p.email, c.title
      from enrollments e join profiles p on p.id = e.user_id join courses c on c.id = e.course_id
      where e.user_id = ${studentId} and e.course_id = ${courseId}`;
    if (!h) return null;
    const lessons = await tx<(Omit<LessonProgress, "attempts"> & { passScore: number | null })[]>`
      select l.id, l.title, m.title as "moduleTitle", l.kind, l.exam, l.pass_score as "passScore", lp.completed_at as "doneAt"
      from lessons l join modules m on m.id = l.module_id
      left join lesson_progress lp on lp.lesson_id = l.id and lp.user_id = ${studentId}
      where m.course_id = ${courseId} order by m.position, l.position`;
    const subs = await tx<{
      id: string; lessonId: string; at: Date; status: "pending" | "reviewed"; auto: number | null; teacher: number | null;
      feedback: string | null; text: string | null; byAi: boolean;
    }[]>`
      select s.id, s.lesson_id as "lessonId", s.created_at as at, s.status, s.auto_score::float as auto, s.teacher_score::float as teacher,
             s.feedback, s.answers ->> 'text' as text, (s.ai_draft is not null and s.reviewed_by is null and s.status = 'reviewed') as "byAi"
      from exam_submissions s join lessons l on l.id = s.lesson_id join modules m on m.id = l.module_id
      where s.user_id = ${studentId} and m.course_id = ${courseId} order by s.created_at`;
    return {
      studentId, name: h.name, email: h.email, courseTitle: h.title,
      lessons: lessons.map((l) => ({
        id: l.id, title: l.title, moduleTitle: l.moduleTitle, kind: l.kind, exam: l.exam, doneAt: l.doneAt,
        attempts: subs.filter((s) => s.lessonId === l.id).map((s) => {
          const score = s.auto ?? s.teacher;
          const pass = l.exam === "quiz" ? (l.passScore ?? 70) : 50;
          return {
            id: s.id, at: s.at, status: s.status, score, passed: s.status === "reviewed" && score != null ? score >= pass : null,
            feedback: s.feedback, text: s.text, byAi: s.byAi,
          };
        }),
      })),
    };
  });
}
