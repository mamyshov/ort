import "server-only";
import { withUser } from "./db";
import type { Localized } from "./content";

export type LessonKind = "video" | "text" | "exam";
export type ExamKind = "quiz" | "assignment";

export type MyCourse = {
  id: string;
  slug: string;
  title: Localized;
  description: Localized;
  total: number;
  done: number;
  nextLessonId: string | null;
};

/** Курсы, к которым у ученика есть доступ, с прогрессом и следующим непройденным уроком. */
export async function getMyCourses(userId: string): Promise<MyCourse[]> {
  return withUser(userId, async (tx) => {
    const courses = await tx<Omit<MyCourse, "nextLessonId">[]>`
      select c.id, c.slug, c.title, c.description,
             count(l.id)::int as total, count(lp.lesson_id)::int as done
      from enrollments e
      join courses c on c.id = e.course_id
      left join modules m on m.course_id = c.id
      left join lessons l on l.module_id = m.id
      left join lesson_progress lp on lp.lesson_id = l.id and lp.user_id = e.user_id
      where e.user_id = ${userId} and e.status = 'active'
        and (e.expires_at is null or e.expires_at > now())
      group by c.id, e.granted_at
      order by e.granted_at`;
    const result: MyCourse[] = [];
    for (const c of courses) {
      const [next] = await tx<{ id: string }[]>`
        select l.id from lessons l join modules m on m.id = l.module_id
        where m.course_id = ${c.id}
          and not exists (select 1 from lesson_progress lp where lp.lesson_id = l.id and lp.user_id = ${userId})
        order by m.position, l.position limit 1`;
      result.push({ ...c, nextLessonId: next?.id ?? null });
    }
    return result;
  });
}

export type OutlineLesson = {
  id: string;
  title: Localized;
  kind: LessonKind;
  exam: ExamKind | null;
  done: boolean;
};
export type OutlineModule = { id: string; title: Localized; lessons: OutlineLesson[] };
export type CourseOutline = {
  id: string;
  slug: string;
  title: Localized;
  description: Localized;
  modules: OutlineModule[];
};

export async function getCourseOutline(userId: string, slug: string): Promise<CourseOutline | null> {
  return withUser(userId, async (tx) => {
    const [course] = await tx<{ id: string; slug: string; title: Localized; description: Localized }[]>`
      select id, slug, title, description from courses where slug = ${slug}`;
    if (!course) return null;
    // Структуру курса видит только тот, у кого есть доступ (или сотрудник курса)
    const [access] = await tx<{ ok: boolean }[]>`select can_view_course(${course.id}) as ok`;
    if (!access?.ok) return null;
    const modules = await tx<{ id: string; title: Localized }[]>`
      select id, title from modules where course_id = ${course.id} order by position`;
    const lessons = await tx<(OutlineLesson & { module_id: string })[]>`
      select l.id, l.module_id, l.title, l.kind, l.exam, (lp.lesson_id is not null) as done
      from lessons l join modules m on m.id = l.module_id
      left join lesson_progress lp on lp.lesson_id = l.id and lp.user_id = ${userId}
      where m.course_id = ${course.id}
      order by m.position, l.position`;
    return {
      ...course,
      modules: modules.map((m) => ({
        ...m,
        lessons: lessons.filter((l) => l.module_id === m.id),
      })),
    };
  });
}

export type LessonDetail = {
  id: string;
  title: Localized;
  kind: LessonKind;
  exam: ExamKind | null;
  videoProvider: "bunny" | "youtube" | "vimeo" | null;
  videoRef: string | null;
  content: { body?: Localized; prompt?: Localized };
  passScore: number | null;
  done: boolean;
  courseSlug: string;
  courseTitle: Localized;
  moduleTitle: Localized;
  prevId: string | null;
  nextId: string | null;
};

export async function getLesson(userId: string, lessonId: string): Promise<LessonDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(lessonId)) return null;
  return withUser(userId, async (tx) => {
    const [l] = await tx<
      {
        id: string; title: Localized; kind: LessonKind; exam: ExamKind | null;
        video_provider: LessonDetail["videoProvider"]; video_ref: string | null;
        content: LessonDetail["content"]; pass_score: number | null; done: boolean;
        course_id: string; slug: string; course_title: Localized; module_title: Localized;
      }[]
    >`
      select l.id, l.title, l.kind, l.exam, l.video_provider, l.video_ref, l.content, l.pass_score,
             (lp.lesson_id is not null) as done,
             c.id as course_id, c.slug, c.title as course_title, m.title as module_title
      from lessons l
      join modules m on m.id = l.module_id
      join courses c on c.id = m.course_id
      left join lesson_progress lp on lp.lesson_id = l.id and lp.user_id = ${userId}
      where l.id = ${lessonId}`;
    if (!l) return null;
    const order = await tx<{ id: string }[]>`
      select l2.id from lessons l2 join modules m2 on m2.id = l2.module_id
      where m2.course_id = ${l.course_id} order by m2.position, l2.position`;
    const i = order.findIndex((r) => r.id === l.id);
    return {
      id: l.id, title: l.title, kind: l.kind, exam: l.exam,
      videoProvider: l.video_provider, videoRef: l.video_ref, content: l.content,
      passScore: l.pass_score, done: l.done,
      courseSlug: l.slug, courseTitle: l.course_title, moduleTitle: l.module_title,
      prevId: i > 0 ? order[i - 1].id : null,
      nextId: i >= 0 && i < order.length - 1 ? order[i + 1].id : null,
    };
  });
}

/** Отметка урока. Права проверяет база: нельзя отметить урок курса без доступа. */
export async function setLessonDone(userId: string, lessonId: string, done: boolean): Promise<void> {
  await withUser(userId, async (tx) => {
    if (done) {
      await tx`
        insert into lesson_progress (user_id, lesson_id) values (${userId}, ${lessonId})
        on conflict do nothing`;
    } else {
      await tx`delete from lesson_progress where user_id = ${userId} and lesson_id = ${lessonId}`;
    }
  });
}

export type SearchHit = {
  id: string;
  title: Localized;
  courseTitle: Localized;
  moduleTitle: Localized;
  kind: LessonKind;
  exam: ExamKind | null;
};

/** Поиск по названиям и тексту уроков. Показывает только курсы, к которым есть доступ. */
export async function searchLessons(userId: string, query: string, locale: string): Promise<SearchHit[]> {
  const like = `%${query.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
  return withUser(userId, async (tx) =>
    tx<SearchHit[]>`
      select l.id, l.title, l.kind, l.exam, c.title as "courseTitle", m.title as "moduleTitle"
      from lessons l
      join modules m on m.id = l.module_id
      join courses c on c.id = m.course_id
      where (l.title ->> ${locale} ilike ${like}
          or l.title ->> 'ru' ilike ${like}
          or l.content::text ilike ${like})
        and exists (select 1 from enrollments e where e.user_id = ${userId}
                    and e.course_id = c.id and e.status = 'active')
      order by c.slug, m.position, l.position
      limit 50`,
  );
}

/** Сколько дней подряд ученик проходил уроки (по UTC). Серия не обрывается, если сегодня ещё не занимался, но вчера занимался. */
export async function getStreak(userId: string): Promise<number> {
  const rows = await withUser(userId, (tx) => tx<{ d: Date }[]>`
    select distinct (completed_at at time zone 'utc')::date as d
    from lesson_progress where user_id = ${userId}
    order by d desc limit 400`);
  const day = 86400000;
  const today = Math.floor(Date.now() / day);
  let expected = today;
  let streak = 0;
  for (const r of rows) {
    const n = Math.floor(new Date(r.d).getTime() / day);
    if (streak === 0 && n === today - 1) expected = today - 1;
    if (n === expected) { streak++; expected--; } else if (n < expected) break;
  }
  return streak;
}
