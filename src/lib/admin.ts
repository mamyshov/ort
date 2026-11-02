import "server-only";
import { service, withUser } from "./db";
import type { Localized } from "./content";
import { fingerprint } from "./questions";
import { settlePayment } from "./payments";

const audit = (tx: Parameters<Parameters<typeof withUser>[1]>[0], actor: string, action: string, entity: string, id?: string, data: object = {}) =>
  tx`insert into audit_log (actor_id, action, entity, entity_id, data) values (${actor}, ${action}, ${entity}, ${id ?? null}, ${tx.json(data as never)})`;

export async function dashboardCounts() {
  const [r] = await service()<{ students: number; premium: number; published: number; drafts: number; attempts: number }[]>`
    select (select count(*) from profiles where role = 'student')::int as students,
           (select count(distinct user_id) from subscriptions where status = 'active' and expires_at > now())::int as premium,
           (select count(*) from questions where is_published)::int as published,
           (select count(*) from questions where not is_published)::int as drafts,
           (select count(*) from attempts where status = 'finished')::int as attempts`;
  return r;
}

export async function aiUsage() {
  const sql = service();
  const [t] = await sql<{ today: number; week: number }[]>`
    select coalesce(sum(requests) filter (where day = current_date), 0)::int as today,
           coalesce(sum(requests), 0)::int as week from ai_usage where day > current_date - 7`;
  return { ...t, limit: Number(process.env.AI_GLOBAL_DAILY_LIMIT) || 500 };
}

/* ---------- Разделы и темы ---------- */
export type SectionAdmin = { id: string; slug: string; kind: string; title: Localized; position: number; isPublished: boolean };
export const adminSections = (staffId: string) => withUser(staffId, (tx) =>
  tx<SectionAdmin[]>`select id, slug, kind, title, position, is_published as "isPublished" from sections order by position, slug`);
export const adminTopics = (staffId: string, sectionId: string) => withUser(staffId, (tx) =>
  tx<{ id: string; title: Localized; position: number }[]>`select id, title, position from topics where section_id = ${sectionId} order by position`);

export async function saveSection(staffId: string, i: { id?: string; slug: string; kind: string; title: Localized; position: number; isPublished: boolean }) {
  return withUser(staffId, async (tx) => {
    const [r] = i.id
      ? await tx<{ id: string }[]>`update sections set slug = ${i.slug}, kind = ${i.kind}, title = ${tx.json(i.title as never)}, position = ${i.position}, is_published = ${i.isPublished} where id = ${i.id} returning id`
      : await tx<{ id: string }[]>`insert into sections (slug, kind, title, position, is_published) values (${i.slug}, ${i.kind}, ${tx.json(i.title as never)}, ${i.position}, ${i.isPublished}) returning id`;
    if (r) await audit(tx, staffId, i.id ? "section.update" : "section.create", "section", r.id);
    return r?.id ?? null;
  });
}

export const saveTopic = (staffId: string, i: { id?: string; sectionId: string; title: Localized; position: number }) =>
  withUser(staffId, async (tx) => {
    const [r] = i.id
      ? await tx<{ id: string }[]>`update topics set title = ${tx.json(i.title as never)}, position = ${i.position} where id = ${i.id} returning id`
      : await tx<{ id: string }[]>`insert into topics (section_id, title, position) values (${i.sectionId}, ${tx.json(i.title as never)}, ${i.position}) returning id`;
    if (r) await audit(tx, staffId, i.id ? "topic.update" : "topic.create", "topic", r.id);
  });

/* ---------- Вопросы ---------- */
export type QuestionRow = {
  id: string; sectionTitle: Localized; topicTitle: Localized | null; prompt: Localized; isPublished: boolean;
  isFree: boolean; hasKey: boolean; difficulty: number;
};

export async function listQuestions(staffId: string, f: { sectionId?: string; status?: string; q?: string }, limit = 100, offset = 0) {
  return withUser(staffId, (tx) => tx<QuestionRow[]>`
    select q.id, s.title as "sectionTitle", t.title as "topicTitle", q.prompt, q.is_published as "isPublished",
           q.is_free as "isFree", q.difficulty, exists (select 1 from question_keys k where k.question_id = q.id) as "hasKey"
    from questions q join sections s on s.id = q.section_id left join topics t on t.id = q.topic_id
    where (${f.sectionId ?? null}::uuid is null or q.section_id = ${f.sectionId ?? null})
      and (${f.status ?? ""} = '' or (${f.status ?? ""} = 'published' and q.is_published)
           or (${f.status ?? ""} = 'draft' and not q.is_published))
      and (${f.q ?? ""} = '' or q.prompt::text ilike ${"%" + (f.q ?? "") + "%"})
    order by q.created_at desc limit ${limit} offset ${offset}`);
}

export type QuestionFull = {
  id: string; sectionId: string; topicId: string | null; passage: Localized | null; prompt: Localized;
  options: { id: string; text: Localized }[]; difficulty: number; isFree: boolean; isPublished: boolean;
  correct: string | null; explanation: Localized;
};

export async function getQuestion(staffId: string, id: string): Promise<QuestionFull | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  return withUser(staffId, async (tx) => {
    const [r] = await tx<QuestionFull[]>`
      select q.id, q.section_id as "sectionId", q.topic_id as "topicId", q.passage, q.prompt, q.options,
             q.difficulty, q.is_free as "isFree", q.is_published as "isPublished",
             k.correct_option as correct, coalesce(k.explanation, '{}') as explanation
      from questions q left join question_keys k on k.question_id = q.id where q.id = ${id}`;
    return r ?? null;
  });
}

export type QuestionInput = {
  id?: string; sectionId: string; topicId: string | null; passage: Localized | null; prompt: Localized;
  options: { id: string; text: Localized }[]; difficulty: number; isFree: boolean; wantPublish: boolean;
  correct: string | null; explanation: Localized;
};

/** Сохраняет вопрос и ключ. Публикуется только при наличии правильного ответа. Возвращает id или причину отказа. */
export async function saveQuestion(staffId: string, i: QuestionInput): Promise<{ id: string } | { error: "duplicate" | "invalid" }> {
  if (i.options.length < 2 || i.options.length > 6) return { error: "invalid" };
  const fp = fingerprint(i.prompt, i.options.map((o) => o.text), i.passage);
  try {
    return await withUser(staffId, async (tx) => {
      const [dup] = await tx`select 1 from questions where fingerprint = ${fp} and id is distinct from ${i.id ?? null}`;
      if (dup) return { error: "duplicate" as const };
      const publish = i.wantPublish && Boolean(i.correct);
      const base = [i.sectionId, i.topicId, i.passage ? tx.json(i.passage as never) : null, tx.json(i.prompt as never), tx.json(i.options as never), i.difficulty, i.isFree] as const;
      let id = i.id;
      if (id) {
        await tx`update questions set section_id = ${base[0]}, topic_id = ${base[1]}, passage = ${base[2]}, prompt = ${base[3]},
                 options = ${base[4]}, difficulty = ${base[5]}, is_free = ${base[6]}, is_published = false, fingerprint = ${fp} where id = ${id}`;
      } else {
        [{ id }] = await tx<{ id: string }[]>`
          insert into questions (section_id, topic_id, passage, prompt, options, difficulty, is_free, is_published, fingerprint)
          values (${base[0]}, ${base[1]}, ${base[2]}, ${base[3]}, ${base[4]}, ${base[5]}, ${base[6]}, false, ${fp}) returning id`;
      }
      if (i.correct) {
        await tx`insert into question_keys (question_id, correct_option, explanation) values (${id!}, ${i.correct}, ${tx.json(i.explanation as never)})
                 on conflict (question_id) do update set correct_option = excluded.correct_option, explanation = excluded.explanation`;
      } else {
        await tx`delete from question_keys where question_id = ${id!}`;
      }
      if (publish) await tx`update questions set is_published = true where id = ${id!}`;
      await audit(tx, staffId, i.id ? "question.update" : "question.create", "question", id);
      return { id: id! };
    });
  } catch {
    return { error: "invalid" };
  }
}

export const setPublished = (staffId: string, id: string, on: boolean) =>
  withUser(staffId, async (tx) => {
    await tx`update questions set is_published = ${on} where id = ${id}`;
    await audit(tx, staffId, on ? "question.publish" : "question.unpublish", "question", id);
  }).then(() => true).catch(() => false);

export const deleteQuestion = (staffId: string, id: string) =>
  withUser(staffId, async (tx) => {
    await tx`delete from questions where id = ${id}`;
    await audit(tx, staffId, "question.delete", "question", id);
  });

/* ---------- Пробные тесты ---------- */
export type MockAdmin = { id: string; slug: string; title: Localized; durationMin: number; isFree: boolean; isPublished: boolean;
  parts: { sectionId: string; count: number }[] };

export const adminMocks = (staffId: string) => withUser(staffId, (tx) => tx<MockAdmin[]>`
  select m.id, m.slug, m.title, m.duration_min as "durationMin", m.is_free as "isFree", m.is_published as "isPublished",
         coalesce((select jsonb_agg(jsonb_build_object('sectionId', p.section_id, 'count', p.question_count)) from mock_test_parts p where p.mock_id = m.id), '[]') as parts
  from mock_tests m order by m.position, m.slug`);

export const saveMock = (staffId: string, i: { id?: string; slug: string; title: Localized; durationMin: number; isFree: boolean; isPublished: boolean; parts: { sectionId: string; count: number }[] }) =>
  withUser(staffId, async (tx) => {
    const [m] = i.id
      ? await tx<{ id: string }[]>`update mock_tests set slug = ${i.slug}, title = ${tx.json(i.title as never)}, duration_min = ${i.durationMin}, is_free = ${i.isFree}, is_published = ${i.isPublished} where id = ${i.id} returning id`
      : await tx<{ id: string }[]>`insert into mock_tests (slug, title, duration_min, is_free, is_published) values (${i.slug}, ${tx.json(i.title as never)}, ${i.durationMin}, ${i.isFree}, ${i.isPublished}) returning id`;
    await tx`delete from mock_test_parts where mock_id = ${m.id}`;
    for (const p of i.parts.filter((x) => x.count > 0)) {
      await tx`insert into mock_test_parts (mock_id, section_id, question_count) values (${m.id}, ${p.sectionId}, ${p.count})`;
    }
    await audit(tx, staffId, i.id ? "mock.update" : "mock.create", "mock", m.id);
  });

/* ---------- Ученики, доступ, платежи ---------- */
export type StudentRow = { id: string; email: string; fullName: string | null; schoolLanguage: string | null; createdAt: Date; until: Date | null; attempts: number };

export const listStudents = (staffId: string, q = "") => withUser(staffId, (tx) => tx<StudentRow[]>`
  select p.id, p.email, p.full_name as "fullName", p.school_language as "schoolLanguage", p.created_at as "createdAt",
         (select max(expires_at) from subscriptions s where s.user_id = p.id and s.status = 'active' and s.expires_at > now()) as until,
         (select count(*) from attempts a where a.user_id = p.id)::int as attempts
  from profiles p where p.role = 'student'
    and (${q} = '' or p.email ilike ${"%" + q + "%"} or p.full_name ilike ${"%" + q + "%"})
  order by p.created_at desc limit 200`);

export const grantAccess = (staffId: string, userId: string, days: number) =>
  withUser(staffId, async (tx) => {
    const d = Math.max(1, Math.min(730, Math.floor(days)));
    await tx`insert into subscriptions (user_id, source, expires_at)
             values (${userId}, 'manual', greatest(now(), coalesce((select max(expires_at) from subscriptions where user_id = ${userId} and status = 'active'), now())) + make_interval(days => ${d}))`;
    await audit(tx, staffId, "access.grant", "profile", userId, { days: d });
  });

export const revokeAccess = (staffId: string, userId: string) =>
  withUser(staffId, async (tx) => {
    await tx`update subscriptions set status = 'revoked', revoked_at = now() where user_id = ${userId} and status = 'active'`;
    await audit(tx, staffId, "access.revoke", "profile", userId);
  });

export type PaymentRow = {
  id: string; createdAt: Date; buyer: string; email: string | null; amount: number; method: string;
  status: "pending" | "paid" | "refunded" | "failed"; packageTitle: Localized | null;
};

export const listPayments = (staffId: string) => withUser(staffId, (tx) => tx<PaymentRow[]>`
  select p.id, p.created_at as "createdAt", coalesce(p.payer_name, '') as buyer, p.payer_email as email,
         p.amount::float as amount, p.method, p.status, k.title as "packageTitle"
  from payments p left join packages k on k.id = p.package_id order by p.created_at desc limit 200`);

/** Ручное подтверждение платежа сотрудником: тот же путь, что у настоящего уведомления. */
export async function confirmPayment(staffId: string, paymentId: string): Promise<boolean> {
  const row = await withUser(staffId, (tx) => tx<{ order_ref: string }[]>`select order_ref from payments where id = ${paymentId} and status in ('pending', 'failed')`);
  if (!row[0]) return false;
  const r = await settlePayment(row[0].order_ref, `manual-${paymentId}`);
  if (r.ok) await withUser(staffId, (tx) => audit(tx, staffId, "payment.confirm", "payment", paymentId));
  return r.ok;
}

export const listAudit = (staffId: string) => withUser(staffId, (tx) => tx<{ id: number; actor: string | null; action: string; entity: string; entityId: string | null; createdAt: Date }[]>`
  select a.id, p.email as actor, a.action, a.entity, a.entity_id as "entityId", a.created_at as "createdAt"
  from audit_log a left join profiles p on p.id = a.actor_id order by a.id desc limit 200`);
