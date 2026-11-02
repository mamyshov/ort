// Тестовые данные для разработки и показа. НЕ запускать на рабочей базе.
// Использование: npm run db:seed   (после npm run db:migrate)
import postgres from "postgres";
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";

if (process.env.NODE_ENV === "production" && process.env.DEMO_MODE !== "1") throw new Error("Тестовые данные нельзя загружать в рабочую базу");
const url = process.env.DATABASE_URL;
if (!url) throw new Error("Не задана DATABASE_URL");
const sql = postgres(url, { max: 1, onnotice: () => {} });
const scryptAsync = promisify(scrypt);

async function hash(password) {
  const salt = randomBytes(16);
  const h = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${h.toString("base64")}`;
}

const t = (ru, ky, en) => ({ ru, ky, en });
const PASSWORD = "demo12345";

await sql`truncate profiles, courses, packages, leads restart identity cascade`;

const users = {};
for (const [key, role, name] of [
  ["owner", "owner", "Владелец Демо"],
  ["manager", "manager", "Менеджер Демо"],
  ["teacher1", "teacher", "Преподаватель Один"],
  ["teacher2", "teacher", "Преподаватель Два"],
  ["student", "student", "Ученик Демо"],
  ["student2", "student", "Ученик Без Доступа"],
]) {
  const [p] = await sql`insert into profiles (email, full_name, role) values (${key + "@demo.local"}, ${name}, ${role}) returning id`;
  await sql`insert into credentials (user_id, password_hash) values (${p.id}, ${await hash(PASSWORD)})`;
  users[key] = p.id;
}

const [c1] = await sql`insert into courses (slug, title, description, is_published) values
  ('english-basic', ${t("Английский с нуля", "Англис тили нөлдөн", "English from scratch")},
   ${t("Первые фразы, чтение и простые диалоги", "Алгачкы фразалар, окуу жана жөнөкөй диалогдор", "First phrases, reading and simple dialogues")}, true) returning id`;
const [c2] = await sql`insert into courses (slug, title, description, is_published) values
  ('english-speaking', ${t("Разговорный английский", "Сүйлөшүү англис тили", "Spoken English")},
   ${t("Практика речи по темам", "Темалар боюнча сүйлөө практикасы", "Speaking practice by topic")}, true) returning id`;

await sql`insert into course_teachers values (${c1.id}, ${users.teacher1}), (${c2.id}, ${users.teacher2})`;

async function addModule(course, pos, title, lessons) {
  const [m] = await sql`insert into modules (course_id, position, title) values (${course}, ${pos}, ${title}) returning id`;
  const ids = [];
  let i = 1;
  for (const l of lessons) {
    const [row] = await sql`
      insert into lessons (module_id, position, title, kind, exam, video_provider, video_ref, content, pass_score)
      values (${m.id}, ${i++}, ${l.title}, ${l.kind ?? "video"}, ${l.exam ?? null},
              ${l.kind === "video" || !l.kind ? "youtube" : null}, ${l.kind === "video" || !l.kind ? "M7lc1UVf-VE" : null},
              ${sql.json(l.content ?? {})}, ${l.pass ?? null}) returning id`;
    ids.push(row.id);
  }
  return ids;
}

const m1 = await addModule(c1.id, 1, t("Модуль 1. Знакомство", "1-модуль. Таанышуу", "Module 1. Getting acquainted"), [
  { title: t("Урок 1. Привет и пока", "1-сабак. Салам жана коштошуу", "Lesson 1. Hello and goodbye") },
  { title: t("Урок 2. Представляемся", "2-сабак. Өзүбүздү тааныштыруу", "Lesson 2. Introducing yourself") },
  { kind: "text", title: t("Памятка: основные фразы", "Эскертме: негизги фразалар", "Cheat sheet: key phrases"),
    content: { body: t("Hello — привет. My name is… — меня зовут… Nice to meet you — приятно познакомиться.", "Hello — салам. My name is… — менин атым… Nice to meet you — таанышканыма кубанычтамын.", "Hello. My name is… Nice to meet you.") } },
  { kind: "exam", exam: "quiz", pass: 70, title: t("Тест модуля 1", "1-модулдун тести", "Module 1 quiz") },
]);
await addModule(c1.id, 2, t("Модуль 2. Чтение", "2-модуль. Окуу", "Module 2. Reading"), [
  { title: t("Урок 1. Буквы и звуки", "1-сабак. Тамгалар жана үндөр", "Lesson 1. Letters and sounds") },
  { title: t("Урок 2. Транскрипция", "2-сабак. Транскрипция", "Lesson 2. Transcription") },
  { kind: "exam", exam: "assignment", title: t("Задание: прочитайте и опишите", "Тапшырма: окуңуз жана сүрөттөңүз", "Assignment: read and describe"),
    content: { prompt: t("Напишите 5 предложений о себе по-английски.", "Өзүңүз тууралуу англисче 5 сүйлөм жазыңыз.", "Write 5 sentences about yourself in English.") } },
]);
await addModule(c2.id, 1, t("Модуль 1. Разговор о жизни", "1-модуль. Жашоо жөнүндө сүйлөшүү", "Module 1. Talking about life"), [
  { title: t("Урок 1. Семья", "1-сабак. Үй-бүлө", "Lesson 1. Family") },
  { title: t("Урок 2. Работа", "2-сабак. Жумуш", "Lesson 2. Work") },
]);

const [quizLesson] = await sql`select id from lessons where kind='exam' and exam='quiz'`;
const qs = [
  [t("Как сказать «Привет»?", "«Салам» англисче кандай?", "How do you say “Hello”?"), "a", [["a", "Hello"], ["b", "Goodbye"], ["c", "Thanks"]]],
  [t("Выберите: «Меня зовут Анна»", "Тандаңыз: «Менин атым Анна»", "Choose: “My name is Anna”"), "b", [["a", "I am name Anna"], ["b", "My name is Anna"], ["c", "Name my Anna"]]],
  [t("Как сказать «Приятно познакомиться»?", "«Таанышканыма кубанычтамын» англисче кандай?", "How do you say “Nice to meet you”?"), "c", [["a", "See you"], ["b", "Good night"], ["c", "Nice to meet you"]]],
];
let pos = 1;
for (const [prompt, correct, opts] of qs) {
  await sql`insert into quiz_questions (lesson_id, position, prompt, options, correct_option)
    values (${quizLesson.id}, ${pos++}, ${prompt}, ${sql.json(opts.map(([id, text]) => ({ id, text: t(text, text, text) })))}, ${correct})`;
}

const [basic] = await sql`insert into packages (slug, title, price_usd, list_price_usd) values ('basic', ${t("Основной пакет", "Негизги пакет", "Basic package")}, 79, 129) returning id`;
const [full] = await sql`insert into packages (slug, title, price_usd, list_price_usd) values ('full', ${t("Полный пакет", "Толук пакет", "Full package")}, 99, 149) returning id`;
const [adv] = await sql`insert into packages (slug, title, price_usd, is_upsell) values ('advanced', ${t("Продвинутые программы", "Өркүндөтүлгөн программалар", "Advanced programs")}, 20, true) returning id`;
await sql`insert into package_courses values (${basic.id}, ${c1.id}), (${full.id}, ${c1.id}), (${full.id}, ${c2.id}), (${adv.id}, ${c2.id})`;

await sql`insert into enrollments (user_id, course_id, package_id) values (${users.student}, ${c1.id}, ${basic.id})`;
await sql`insert into lesson_progress (user_id, lesson_id) values (${users.student}, ${m1[0]}), (${users.student}, ${m1[1]})`;

await sql`insert into leads (name, phone, email, source, status) values
  ('Айгуль', '+996 555 000 111', 'aigul@example.com', 'webinar', 'registered'),
  ('Бакыт', '+996 555 000 222', 'bakyt@example.com', 'instagram', 'attended'),
  ('Нургуль', '+996 555 000 333', null, 'facebook', 'joined_group')`;

console.log(`Готово. Вход для проверки (пароль у всех ${PASSWORD}):`);
for (const k of Object.keys(users)) console.log(`  ${k}@demo.local`);
await sql.end();
