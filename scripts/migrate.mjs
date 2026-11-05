// Применяет файлы из db/migrations по порядку. Уже применённые пропускает.
// Использование: node --env-file=.env.local scripts/migrate.mjs
import postgres from "postgres";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Не задана DATABASE_URL");

const sql = postgres(url, { max: 1, onnotice: () => {} });
const dir = join(import.meta.dirname, "..", "db", "migrations");

await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
// Служебная таблица не должна быть доступна через внешний API хостинга (Supabase и подобные)
await sql`alter table schema_migrations enable row level security`;
const done = new Set((await sql`select name from schema_migrations`).map((r) => r.name));

for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  if (done.has(file)) continue;
  console.log("Применяю", file);
  await sql.begin(async (tx) => {
    await tx.unsafe(readFileSync(join(dir, file), "utf8"));
    await tx`insert into schema_migrations (name) values (${file})`;
  });
}
console.log("Миграции применены");
await sql.end();
