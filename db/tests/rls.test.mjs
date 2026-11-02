import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL("../migrations/", import.meta.url);
const migration = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()
  .map((f) => readFileSync(new URL(f, dir), "utf8")).join("\n");
const db = new PGlite();

await db.exec(migration);
const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const U = { owner: id(1), manager: id(2), teacherA: id(3), teacherB: id(4), s1: id(5), s2: id(6), kid: id(7) };

for (const [k, v] of Object.entries(U)) {
  if (k === "kid") continue;
  await db.query("insert into profiles (id, email, full_name) values ($1, $2, $3)", [v, `${k}@example.com`, k]);
}
await db.exec(`insert into profiles (id, email, full_name, guardian_id, age_group) values ('${U.kid}','child-kid@children.invalid','kid','${U.s1}','kids');`);
await db.exec(`
  update profiles set role='owner'   where id='${U.owner}';
  update profiles set role='manager' where id='${U.manager}';
  update profiles set role='teacher' where id in ('${U.teacherA}','${U.teacherB}');
  insert into courses (id, slug, title, is_published) values
    ('${id(10)}','a','{"ru":"A"}',true), ('${id(11)}','b','{"ru":"B"}',true);
  insert into course_teachers values ('${id(10)}','${U.teacherA}'), ('${id(11)}','${U.teacherB}');
  insert into modules (id, course_id, position, title) values
    ('${id(20)}','${id(10)}',1,'{"ru":"mA"}'), ('${id(21)}','${id(11)}',1,'{"ru":"mB"}');
  insert into lessons (id, module_id, position, title, kind, exam) values
    ('${id(30)}','${id(20)}',1,'{"ru":"lA"}','video',null),
    ('${id(31)}','${id(21)}',1,'{"ru":"lB"}','video',null),
    ('${id(32)}','${id(20)}',2,'{"ru":"examA"}','exam','assignment');
  insert into enrollments (user_id, course_id) values ('${U.s1}','${id(10)}');
  insert into exam_submissions (user_id, lesson_id, answers) values ('${U.s1}','${id(32)}','{}');
  insert into quiz_questions (lesson_id, position, prompt, options, correct_option)
    values ('${id(32)}',1,'{"ru":"q"}','[]','a');
  insert into packages (id, slug, title, price_usd) values ('${id(40)}','basic','{"ru":"x"}',79);
  insert into payments (id, user_id, package_id, amount, method, status, provider_ref) values
    ('${id(50)}','${U.s1}','${id(40)}',79,'card','paid','ref1'),
    ('${id(51)}','${U.s1}','${id(40)}',79,'card','paid','ref2');
`);

let failed = 0;
async function as(who, sql) {
  await db.exec(`reset role; set role authenticated; select set_config('app.user_id','${U[who]}', false);`);
  try { return { rows: (await db.query(sql)).rows }; }
  catch (e) { return { error: e.message }; }
  finally { await db.exec("reset role"); }
}
async function expectCount(name, who, sql, n) {
  const r = await as(who, sql);
  const got = r.error ? `ERROR ${r.error}` : r.rows.length;
  const ok = got === n;
  if (!ok) failed++;
  console.log(`${ok ? "OK  " : "FAIL"} ${name} (ожидалось ${n}, получено ${got})`);
}
async function expectError(name, who, sql) {
  const r = await as(who, sql);
  const ok = !!r.error;
  if (!ok) failed++;
  console.log(`${ok ? "OK  " : "FAIL"} ${name} ${ok ? "(запрещено)" : "(ПРОШЛО, а не должно)"}`);
}

await expectCount("ученик с доступом видит уроки своего курса", "s1", "select 1 from lessons", 2);
await expectCount("ученик без доступа не видит уроков", "s2", "select 1 from lessons", 0);
await expectCount("ученик видит опубликованные курсы (для продающей)", "s2", "select 1 from courses", 2);
await expectError("ученик не может сделать себя владельцем", "s1", `update profiles set role='owner' where id='${U.s1}'`);
await expectCount("преподаватель A видит уроки только своего курса", "teacherA", "select 1 from lessons", 2);
await expectCount("преподаватель B видит уроки только своего курса", "teacherB", "select 1 from lessons", 1);
await expectCount("менеджер видит все уроки", "manager", "select 1 from lessons", 3);
await expectError("менеджер не может добавлять уроки", "manager", `insert into lessons (module_id, position, title) values ('${id(20)}',9,'{"ru":"x"}')`);
await expectCount("менеджер не видит работы на проверку", "manager", "select 1 from exam_submissions", 0);
await expectCount("преподаватель A видит работы своего курса", "teacherA", "select 1 from exam_submissions", 1);
await expectCount("преподаватель B не видит чужие работы", "teacherB", "select 1 from exam_submissions", 0);
await expectCount("владелец видит работы", "owner", "select 1 from exam_submissions", 1);
await expectError("ученик не может отметить урок чужого курса", "s1", `insert into lesson_progress (user_id, lesson_id) values ('${U.s1}','${id(31)}')`);
await expectCount("ученик отмечает урок своего курса", "s1", `insert into lesson_progress (user_id, lesson_id) values ('${U.s1}','${id(30)}') returning 1`, 1);
await expectError("ученик не может создать платёж", "s1", `insert into payments (user_id, amount, method) values ('${U.s1}', 0, 'card')`);
await expectCount("преподаватель не видит платежи", "teacherA", "select 1 from payments", 0);
await expectCount("менеджер видит платежи", "manager", "select 1 from payments", 2);
await expectCount("менеджер оформляет возврат", "manager", `update payments set status='refunded', refunded_by='${U.manager}', refunded_at=now() where id='${id(50)}' returning 1`, 1);
await expectCount("преподаватель не может менять платежи", "teacherA", `update payments set status='failed' returning 1`, 0);
await expectError("ученик не может записать себе доступ", "s1", `insert into enrollments (user_id, course_id) values ('${U.s1}','${id(11)}')`);
await expectCount("менеджер выдаёт доступ", "manager", `insert into enrollments (user_id, course_id) values ('${U.s2}','${id(10)}') returning 1`, 1);
await expectCount("преподаватель A видит профиль своего ученика", "teacherA", `select 1 from profiles where id='${U.s1}'`, 1);
await expectCount("преподаватель B не видит чужого ученика", "teacherB", `select 1 from profiles where id='${U.s1}'`, 0);
await expectCount("журнал действий читает только владелец (менеджер)", "manager", "select 1 from audit_log", 0);
await expectCount("менеджер пишет в журнал от своего имени", "manager", `insert into audit_log (actor_id, action, entity) values ('${U.manager}','refund','payment') returning 1`, 1);
await expectError("менеджер не может писать в журнал от чужого имени", "manager", `insert into audit_log (actor_id, action, entity) values ('${U.owner}','x','y')`);
await expectCount("владелец читает журнал", "owner", "select 1 from audit_log", 1);

await expectError("ученик не может записать себе балл при сдаче экзамена", "s1", `insert into exam_submissions (user_id, lesson_id, answers, auto_score) values ('${U.s1}','${id(32)}','{}',100)`);
await expectError("ученик не может записать себе оценку преподавателя", "s1", `insert into exam_submissions (user_id, lesson_id, answers, teacher_score) values ('${U.s1}','${id(32)}','{}',100)`);
await expectCount("ученик сдаёт экзамен без оценок", "s1", `insert into exam_submissions (user_id, lesson_id, answers) values ('${U.s1}','${id(32)}','{"a":1}') returning 1`, 1);
await expectError("ученик без доступа не может сдать экзамен", "teacherB", `insert into exam_submissions (user_id, lesson_id, answers) values ('${U.teacherB}','${id(32)}','{}')`);

await expectError("менеджер не может менять сумму платежа", "manager", `update payments set amount=1 where id='${id(50)}'`);
await expectError("возврат нельзя оформить от чужого имени", "owner", `update payments set status='refunded', refunded_by='${U.manager}', refunded_at=now() where id='${id(51)}'`);
await expectError("ученик не читает таблицу паролей", "s1", "select 1 from credentials");
await expectError("ученик не читает сессии", "s1", "select 1 from sessions");
await expectError("ученик не читает кэш ИИ", "s1", "select 1 from ai_cache");
await expectError("преподаватель не читает кэш ИИ", "teacherA", "select 1 from ai_cache");

await expectCount("родитель видит профиль своего ребёнка", "s1", `select 1 from profiles where id='${U.kid}'`, 1);
await expectCount("чужой ученик не видит ребёнка", "s2", `select 1 from profiles where id='${U.kid}'`, 0);
await expectCount("ребёнок не видит профиль родителя", "kid", `select 1 from profiles where id='${U.s1}'`, 0);
await expectCount("чужой не может изменить профиль ребёнка", "s2", `update profiles set full_name='x' where id='${U.kid}' returning 1`, 0);
await expectError("у ребёнка обязателен родитель", "owner", `insert into profiles (email, age_group) values ('x@children.invalid','kids')`);
await expectCount("ученик не видит правильные ответы теста", "s1", "select 1 from quiz_questions", 0);
await expectCount("преподаватель курса видит вопросы теста", "teacherA", "select 1 from quiz_questions", 1);
await expectCount("преподаватель другого курса не видит вопросы", "teacherB", "select 1 from quiz_questions", 0);
await expectCount("менеджер не может удалить вопросы теста", "manager", "delete from quiz_questions returning 1", 0);

await expectError("ученик не может вручную отметить экзамен пройденным", "s1", `insert into lesson_progress (user_id, lesson_id) values ('${U.s1}','${id(32)}')`);
await expectCount("преподаватель курса принимает задание", "teacherA", `update exam_submissions set teacher_score=80, status='reviewed', reviewed_by='${U.teacherA}', reviewed_at=now() where lesson_id='${id(32)}' returning 1`, 2);
await expectCount("преподаватель другого курса не принимает чужое задание", "teacherB", `update exam_submissions set teacher_score=10 returning 1`, 0);
await expectCount("менеджер не видит работы", "manager", "select 1 from exam_submissions", 0);
await expectError("ученик не выдаёт себе сертификат", "s1", `insert into certificates (user_id, course_id, number) values ('${U.s1}','${id(10)}','X-1')`);
await expectError("менеджер не выдаёт сертификат", "manager", `insert into certificates (user_id, course_id, number) values ('${U.s1}','${id(10)}','X-2')`);
await expectCount("преподаватель курса выдаёт сертификат", "teacherA", `insert into certificates (user_id, course_id, number, issued_by) values ('${U.s1}','${id(10)}','X-3','${U.teacherA}') returning 1`, 1);
await expectError("преподаватель не выдаёт сертификат по чужому курсу", "teacherA", `insert into certificates (user_id, course_id, number) values ('${U.s1}','${id(11)}','X-4')`);
await expectCount("ученик видит свой сертификат", "s1", "select 1 from certificates", 1);

await expectCount("менеджер видит очередь сообщений", "manager", "select 1 from messages", 0);
await expectError("менеджер не пишет в очередь сообщений", "manager", `insert into messages (channel, to_address, template) values ('email','a@b.c','x')`);
await expectCount("ученик не видит очередь сообщений", "s1", "select 1 from messages", 0);
await expectError("при возврате нельзя поменять почту плательщика", "owner", `update payments set status='refunded', refunded_by='${U.owner}', refunded_at=now(), payer_email='x@y.z' where id='${id(51)}'`);
await expectCount("возврат с неизменёнными полями проходит", "owner", `update payments set status='refunded', refunded_by='${U.owner}', refunded_at=now() where id='${id(51)}' returning 1`, 1);

console.log(failed === 0 ? "\nВсе проверки пройдены" : `\nНЕ ПРОЙДЕНО: ${failed}`);
process.exit(failed ? 1 : 0);
