import "server-only";
import { service, withUser, type Tx } from "./db";
import type { Localized } from "./content";

/** Запись в журнал действий: делается в той же транзакции, что и само действие. */
export async function audit(
  tx: Tx, actorId: string, action: string, entity: string, entityId: string | null, data: object = {},
) {
  await tx`insert into audit_log (actor_id, action, entity, entity_id, data)
           values (${actorId}, ${action}, ${entity}, ${entityId}, ${tx.json(data as never)})`;
}

export type AdminCourse = { id: string; slug: string; title: Localized; isPublished: boolean; audience?: string };

export const listCourses = (uid: string) =>
  withUser(uid, (tx) => tx<AdminCourse[]>`
    select id, slug, title, is_published as "isPublished" from courses
    where current_user_role() <> 'teacher' or teaches_course(id)
    order by created_at`);

export type CourseEdit = AdminCourse & {
  description: Localized;
  teachers: { id: string; name: string }[];
  modules: {
    id: string; title: Localized;
    lessons: { id: string; title: Localized; kind: string }[];
  }[];
};

export async function getCourseEdit(uid: string, id: string): Promise<CourseEdit | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return withUser(uid, async (tx) => {
    const [c] = await tx<(AdminCourse & { description: Localized })[]>`
      select id, slug, title, description, is_published as "isPublished", audience from courses
      where id = ${id} and (current_user_role() <> 'teacher' or teaches_course(id))`;
    if (!c) return null;
    const teachers = await tx<{ id: string; name: string }[]>`
      select p.id, coalesce(p.full_name, p.email) as name
      from course_teachers ct join profiles p on p.id = ct.teacher_id where ct.course_id = ${id}`;
    const modules = await tx<{ id: string; title: Localized }[]>`
      select id, title from modules where course_id = ${id} order by position`;
    const lessons = await tx<{ id: string; module_id: string; title: Localized; kind: string }[]>`
      select l.id, l.module_id, l.title, l.kind from lessons l
      join modules m on m.id = l.module_id where m.course_id = ${id} order by m.position, l.position`;
    return {
      ...c, teachers,
      modules: modules.map((m) => ({ ...m, lessons: lessons.filter((l) => l.module_id === m.id) })),
    };
  });
}

/** Все преподаватели для назначения. Видит только владелец (правило базы). */
export const listTeachers = (uid: string) =>
  withUser(uid, (tx) => tx<{ id: string; name: string }[]>`
    select id, coalesce(full_name, email) as name from profiles where role = 'teacher' order by 2`);

export type LessonEdit = {
  id: string; courseId: string; title: Localized; kind: "video" | "text" | "exam";
  exam: "quiz" | "assignment" | null; provider: string | null; videoRef: string | null;
  content: { body?: Localized; prompt?: Localized }; passScore: number | null;
};

export async function getLessonEdit(uid: string, id: string): Promise<LessonEdit | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return withUser(uid, async (tx) => {
    const [l] = await tx<LessonEdit[]>`
      select l.id, m.course_id as "courseId", l.title, l.kind, l.exam,
             l.video_provider as provider, l.video_ref as "videoRef", l.content, l.pass_score as "passScore"
      from lessons l join modules m on m.id = l.module_id where l.id = ${id}`;
    return l ?? null;
  });
}

export type StudentRow = { id: string; name: string; email: string; courses: number };

export const listStudents = (uid: string, q: string) => {
  const like = `%${q.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
  return withUser(uid, (tx) => tx<StudentRow[]>`
    select p.id, coalesce(p.full_name, '') as name,
           case when p.guardian_id is null then p.email else '👶 ' || coalesce(g.full_name, g.email) end as email,
           (select count(*)::int from enrollments e where e.user_id = p.id and e.status = 'active') as courses
    from profiles p left join profiles g on g.id = p.guardian_id
    where p.role = 'student' and (${q} = '' or p.email ilike ${like} or p.full_name ilike ${like})
    order by p.created_at desc limit 100`);
};

export type StudentDetail = {
  id: string; name: string; email: string;
  enrollments: { courseId: string; title: Localized; status: string; grantedAt: Date }[];
  grantable: { id: string; title: Localized }[];
};

export async function getStudent(uid: string, id: string): Promise<StudentDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return withUser(uid, async (tx) => {
    const [p] = await tx<{ id: string; name: string; email: string }[]>`
      select id, coalesce(full_name, '') as name, email from profiles where id = ${id} and role = 'student'`;
    if (!p) return null;
    const enrollments = await tx<StudentDetail["enrollments"]>`
      select e.course_id as "courseId", c.title, e.status, e.granted_at as "grantedAt"
      from enrollments e join courses c on c.id = e.course_id where e.user_id = ${id} order by e.granted_at`;
    const grantable = await tx<StudentDetail["grantable"]>`
      select c.id, c.title from courses c
      where not exists (select 1 from enrollments e where e.user_id = ${id} and e.course_id = c.id and e.status = 'active')
      order by c.created_at`;
    return { ...p, enrollments, grantable };
  });
}

export type AuditRow = { id: string; at: Date; who: string; action: string; entity: string; entityId: string | null };

export const listAudit = (uid: string) =>
  withUser(uid, (tx) => tx<AuditRow[]>`
    select a.id::text, a.created_at as at, coalesce(p.full_name, p.email, '—') as who,
           a.action, a.entity, a.entity_id as "entityId"
    from audit_log a left join profiles p on p.id = a.actor_id order by a.id desc limit 200`);

export const dashboardCounts = (uid: string) =>
  withUser(uid, async (tx) => {
    const [r] = await tx<{ students: number; enrollments: number; courses: number }[]>`
      select (select count(*)::int from profiles where role = 'student') as students,
             (select count(*)::int from enrollments where status = 'active') as enrollments,
             (select count(*)::int from courses) as courses`;
    return r;
  });

export type PaymentRow = {
  id: string; status: "pending" | "paid" | "refunded" | "failed"; method: string; amount: number;
  buyer: string; email: string | null; packageTitle: Localized | null; createdAt: Date;
};

export const listPayments = (uid: string) =>
  withUser(uid, (tx) => tx<PaymentRow[]>`
    select p.id, p.status, p.method, p.amount::float as amount,
           coalesce(p.payer_name, pr.full_name, pr.email, '—') as buyer,
           coalesce(p.payer_email, pr.email) as email, k.title as "packageTitle", p.created_at as "createdAt"
    from payments p left join profiles pr on pr.id = p.user_id left join packages k on k.id = p.package_id
    order by p.created_at desc limit 200`);

export type LeadRow = {
  id: string; name: string | null; phone: string | null; email: string | null; source: string | null;
  status: string; createdAt: Date;
};

export const listLeads = (uid: string) =>
  withUser(uid, (tx) => tx<LeadRow[]>`
    select id, name, phone, email, source, status, created_at as "createdAt" from leads order by created_at desc limit 200`);

export type MessageRow = { id: string; channel: string; to: string; template: string; status: string; error: string | null; createdAt: Date };

export const listMessages = (uid: string) =>
  withUser(uid, (tx) => tx<MessageRow[]>`
    select id, channel, to_address as "to", template, status, error, created_at as "createdAt"
    from messages order by created_at desc limit 50`);

export type AiUsage = { today: number; week: number; limit: number; byFeature: { feature: string; n: number }[] };

/** Расход ИИ за сегодня и неделю (только вошедшие ученики и сотрудники; гости считаются в памяти сервера). */
export async function aiUsage(): Promise<AiUsage> {
  const sql = service();
  const [t] = await sql<{ today: number; week: number }[]>`
    select coalesce(sum(requests) filter (where day = current_date), 0)::int as today,
           coalesce(sum(requests) filter (where day > current_date - 7), 0)::int as week
    from ai_usage`;
  const byFeature = await sql<{ feature: string; n: number }[]>`
    select feature, sum(requests)::int as n from ai_usage where day = current_date group by feature order by n desc`;
  return { ...t, limit: Number(process.env.AI_GLOBAL_DAILY_LIMIT) || 500, byFeature };
}
