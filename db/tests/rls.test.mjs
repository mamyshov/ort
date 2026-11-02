import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL("../migrations/", import.meta.url);
const migration = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()
  .map((f) => readFileSync(new URL(f, dir), "utf8")).join("\n");
const db = new PGlite();

await db.exec(migration);
const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const U = { owner: id(1), manager: id(2), free: id(5), paid: id(6) };

for (const [k, v] of Object.entries(U)) {
  await db.query("insert into profiles (id, email, full_name) values ($1, $2, $3)", [v, `${k}@example.com`, k]);
}
await db.exec(`
  update profiles set role='owner'   where id='${U.owner}';
  update profiles set role='manager' where id='${U.manager}';
  insert into sections (id, slug, kind, title, is_published) values
    ('${id(10)}','t-math','main','{"ru":"Математика"}',true),
    ('${id(11)}','t-draft','subject','{"ru":"Черновик"}',false);
  insert into questions (id, section_id, prompt, options, is_free, is_published, fingerprint) values
    ('${id(20)}','${id(10)}','{"ru":"free q"}','[]',true,false,'f1'),
    ('${id(21)}','${id(10)}','{"ru":"paid q"}','[]',false,false,'f2'),
    ('${id(22)}','${id(10)}','{"ru":"unpublished"}','[]',true,false,'f3');
  insert into question_keys (question_id, correct_option) values ('${id(20)}','a'), ('${id(21)}','b');
  update questions set is_published = true where id in ('${id(20)}','${id(21)}');
  insert into packages (id, slug, title, price_usd, access_days) values ('${id(40)}','premium','{"ru":"x"}',9,90);
  insert into subscriptions (user_id, package_id, expires_at) values ('${U.paid}','${id(40)}', now() + interval '30 days');
  insert into attempts (id, user_id, kind, question_ids) values
    ('${id(60)}','${U.free}','practice','[]'), ('${id(61)}','${U.paid}','practice','[]');
  insert into payments (id, user_id, package_id, amount, method, status, provider_ref) values
    ('${id(50)}','${U.paid}','${id(40)}',9,'card','paid','ref1'),
    ('${id(51)}','${U.paid}','${id(40)}',9,'card','paid','ref2');
`);

let failed = 0;
async function as(who, sql) {
  await db.exec(`reset role; set role authenticated; select set_config('app.user_id','${U[who] ?? ""}', false);`);
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

await expectCount("ученик без доступа видит только бесплатные опубликованные вопросы", "free", "select 1 from questions", 1);
await expectCount("ученик с доступом видит платные опубликованные вопросы", "paid", "select 1 from questions", 2);
await expectCount("владелец видит все вопросы", "owner", "select 1 from questions", 3);
await expectCount("менеджер видит только бесплатные вопросы, как ученик", "manager", "select 1 from questions", 1);
await expectCount("ученик не видит правильные ответы", "paid", "select 1 from question_keys", 0);
await expectCount("менеджер не видит правильные ответы", "manager", "select 1 from question_keys", 0);
await expectCount("владелец видит правильные ответы", "owner", "select 1 from question_keys", 2);
await expectError("ученик не может добавить вопрос", "paid", `insert into questions (section_id, prompt, options, fingerprint) values ('${id(10)}','{"ru":"x"}','[]','fx')`);
await expectError("менеджер не может добавить вопрос", "manager", `insert into questions (section_id, prompt, options, fingerprint) values ('${id(10)}','{"ru":"x"}','[]','fx')`);
await expectError("нельзя опубликовать вопрос без правильного ответа", "owner", `update questions set is_published = true where id='${id(22)}'`);
await expectError("одинаковый вопрос второй раз добавить нельзя", "owner", `insert into questions (section_id, prompt, options, fingerprint) values ('${id(10)}','{"ru":"x"}','[]','f1')`);
await expectCount("гость не видит вопросы", "none", "select 1 from questions", 0);
await expectCount("ученик видит только опубликованные разделы", "free", "select 1 from sections where slug = 't-draft'", 0);
await expectCount("владелец видит и неопубликованные разделы", "owner", "select 1 from sections where slug = 't-draft'", 1);
await expectError("ученик не может сделать себя владельцем", "free", `update profiles set role='owner' where id='${U.free}'`);
await expectError("ученик не может записать попытку", "free", `insert into attempts (user_id, kind, question_ids, correct, total) values ('${U.free}','practice','[]',10,10)`);
await expectError("ученик не может менять свои баллы", "free", `update attempts set correct=100 where user_id='${U.free}'`);
await expectCount("ученик видит только свои попытки", "free", "select 1 from attempts", 1);
await expectCount("менеджер видит все попытки", "manager", "select 1 from attempts", 2);
await expectError("ученик не может создать платёж", "free", `insert into payments (user_id, amount, method) values ('${U.free}', 0, 'card')`);
await expectCount("ученик видит только свои платежи", "free", "select 1 from payments", 0);
await expectCount("менеджер видит платежи", "manager", "select 1 from payments", 2);
await expectCount("менеджер оформляет возврат", "manager", `update payments set status='refunded', refunded_by='${U.manager}', refunded_at=now() where id='${id(50)}' returning 1`, 1);
await expectError("менеджер не может менять сумму платежа", "manager", `update payments set amount=1 where id='${id(51)}'`);
await expectError("возврат нельзя оформить от чужого имени", "owner", `update payments set status='refunded', refunded_by='${U.manager}', refunded_at=now() where id='${id(51)}'`);
await expectError("при возврате нельзя поменять почту плательщика", "owner", `update payments set status='refunded', refunded_by='${U.owner}', refunded_at=now(), payer_email='x@y.z' where id='${id(51)}'`);
await expectCount("возврат с неизменёнными полями проходит", "owner", `update payments set status='refunded', refunded_by='${U.owner}', refunded_at=now() where id='${id(51)}' returning 1`, 1);
await expectError("ученик не может записать себе доступ", "free", `insert into subscriptions (user_id, expires_at) values ('${U.free}', now() + interval '1 year')`);
await expectCount("менеджер выдаёт доступ", "manager", `insert into subscriptions (user_id, expires_at, source) values ('${U.free}', now() + interval '30 days', 'manual') returning 1`, 1);
await expectCount("после выдачи доступа ученик видит платные вопросы", "free", "select 1 from questions", 2);
await expectCount("менеджер пишет в журнал от своего имени", "manager", `insert into audit_log (actor_id, action, entity) values ('${U.manager}','refund','payment') returning 1`, 1);
await expectError("менеджер не пишет в журнал от чужого имени", "manager", `insert into audit_log (actor_id, action, entity) values ('${U.owner}','x','y')`);
await expectCount("менеджер не читает журнал", "manager", "select 1 from audit_log", 0);
await expectCount("владелец читает журнал", "owner", "select 1 from audit_log", 1);
await expectError("ученик не читает таблицу паролей", "free", "select 1 from credentials");
await expectError("ученик не читает сессии", "free", "select 1 from sessions");
await expectError("ученик не читает кэш ИИ", "free", "select 1 from ai_cache");
await expectError("менеджер не читает кэш ИИ", "manager", "select 1 from ai_cache");

console.log(failed === 0 ? "\nВсе проверки пройдены" : `\nНЕ ПРОЙДЕНО: ${failed}`);
process.exit(failed ? 1 : 0);
