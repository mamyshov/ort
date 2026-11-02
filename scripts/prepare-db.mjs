// Запускается перед сборкой на хостинге: применяет миграции. В пробном режиме (DEMO_MODE=1)
// на пустой базе загружает демо-данные. Без DATABASE_URL ничего не делает.
import { spawnSync } from "node:child_process";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  console.log("prepare-db: DATABASE_URL не задан, миграции пропущены");
  process.exit(0);
}
const run = (file) => {
  const r = spawnSync(process.execPath, [file], { stdio: "inherit", env: process.env });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
run("scripts/migrate.mjs");
if (process.env.DEMO_MODE === "1") {
  const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
  const [{ n }] = await sql`select count(*)::int as n from profiles`;
  await sql.end();
  if (n === 0) run("scripts/seed-ort.mjs");
}
