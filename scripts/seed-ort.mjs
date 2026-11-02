// Демо-данные для разработки: пользователи (пароль demo12345), пакеты и несколько ОЧЕВИДНО УЧЕБНЫХ вопросов,
// чтобы проверить тренировку и пробный тест. Это не вопросы ОРТ. На рабочей базе не запускать.
import postgres from "postgres";
import { createHash, randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Не задана DATABASE_URL");
const sql = postgres(url, { max: 1, onnotice: () => {} });

const hashPw = async (pw) => {
  const salt = randomBytes(16);
  const h = await promisify(scrypt)(pw, salt, 64);
  return `scrypt$${salt.toString("base64")}$${h.toString("base64")}`;
};
const norm = (s) => s.toLowerCase().replace(/[\p{P}\p{S}\s]+/gu, "");

for (const [email, name, role, school] of [
  ["owner@demo.local", "Владелец", "owner", "ru"], ["manager@demo.local", "Менеджер", "manager", "ru"],
  ["student@demo.local", "Демо Ученик", "student", "ky"],
]) {
  const [p] = await sql`insert into profiles (email, full_name, role, school_language) values (${email}, ${name}, ${role}, ${school})
    on conflict (lower(email)) do update set role = excluded.role returning id`;
  await sql`insert into credentials (user_id, password_hash) values (${p.id}, ${await hashPw("demo12345")})
    on conflict (user_id) do update set password_hash = excluded.password_hash`;
}

await sql`insert into packages (slug, title, price_usd, access_days) values
  ('premium-30', '{"ru":"Платный доступ, 30 дней (демо-цена)","ky":"Акы төлөнүүчү, 30 күн (демо баа)"}', 5, 30),
  ('premium-90', '{"ru":"Платный доступ, 90 дней (демо-цена)","ky":"Акы төлөнүүчү, 90 күн (демо баа)"}', 12, 90)
  on conflict (slug) do nothing`;

const [main] = await sql`select id from sections where slug = 'main'`;
const [topic] = await sql`select id from topics where section_id = ${main.id} order by position limit 1`;
const demo = [
  ["2 + 2 = ?", ["3", "4", "5", "6"], "b", true], ["10 − 3 = ?", ["6", "7", "8", "9"], "b", true],
  ["3 × 3 = ?", ["6", "8", "9", "12"], "c", false], ["12 ÷ 4 = ?", ["2", "3", "4", "6"], "b", false],
  ["5 + 7 = ?", ["10", "11", "12", "13"], "c", false], ["20 − 8 = ?", ["10", "11", "12", "13"], "c", false],
];
for (const [q, opts, correct, free] of demo) {
  const prompt = { ru: `[Демо] ${q}` };
  const options = opts.map((t, i) => ({ id: "abcd"[i], text: { ru: t } }));
  const fp = createHash("sha256").update([norm(prompt.ru), ...options.map((o) => norm(o.text.ru)).sort()].join("|")).digest("hex");
  const [row] = await sql`insert into questions (section_id, topic_id, prompt, options, is_free, fingerprint)
    values (${main.id}, ${topic.id}, ${sql.json(prompt)}, ${sql.json(options)}, ${free}, ${fp}) on conflict (fingerprint) do nothing returning id`;
  if (!row) continue;
  await sql`insert into question_keys (question_id, correct_option, explanation) values (${row.id}, ${correct}, ${sql.json({ ru: "Демонстрационный вопрос." })})`;
  await sql`update questions set is_published = true where id = ${row.id}`;
}
const [mock] = await sql`insert into mock_tests (slug, title, duration_min, is_free, is_published)
  values ('demo', '{"ru":"Демо-тест","ky":"Демо тест"}', 10, true, true) on conflict (slug) do nothing returning id`;
if (mock) await sql`insert into mock_test_parts (mock_id, section_id, question_count) values (${mock.id}, ${main.id}, 5)`;
console.log("Демо-данные загружены. Вход: owner@demo.local / manager@demo.local / student@demo.local, пароль demo12345");
await sql.end();
