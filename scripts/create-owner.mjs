// Создаёт владельца платформы (первого пользователя на рабочей базе).
// Использование: node --env-file=.env.local scripts/create-owner.mjs owner@example.com "Имя Фамилия"
// Пароль спросит скрыто. Если почта уже есть, роль станет owner и пароль будет заменён.
import postgres from "postgres";
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { createInterface } from "node:readline";

const [email, name = null] = process.argv.slice(2);
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Укажите почту: create-owner.mjs почта [имя]");
const url = process.env.DATABASE_URL;
if (!url) throw new Error("Не задана DATABASE_URL");

const password = process.env.OWNER_PASSWORD ?? await new Promise((resolve) => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  rl.question("Пароль (не короче 8 символов): ", (a) => { rl.close(); resolve(a); });
});
if (password.length < 8) throw new Error("Пароль слишком короткий");

const salt = randomBytes(16);
const h = await promisify(scrypt)(password, salt, 64);
const hash = `scrypt$${salt.toString("base64")}$${h.toString("base64")}`;

const sql = postgres(url, { max: 1, onnotice: () => {} });
const e = email.trim().toLowerCase();
await sql.begin(async (tx) => {
  const [p] = await tx`
    insert into profiles (email, full_name, role) values (${e}, ${name}, 'owner')
    on conflict (lower(email)) do update set role = 'owner' returning id`;
  await tx`insert into credentials (user_id, password_hash) values (${p.id}, ${hash})
           on conflict (user_id) do update set password_hash = excluded.password_hash, updated_at = now()`;
});
console.log(`Владелец ${e} готов.`);
await sql.end();
