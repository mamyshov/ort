import "server-only";
import { randomUUID } from "node:crypto";
import { service } from "./db";
import { startSession, type CurrentUser } from "./auth";
import { verifyPassword, DUMMY_HASH } from "./passwords";

export const MAX_CHILDREN = 6;
export type AgeGroup = "kids" | "teens";
export type Child = { id: string; fullName: string | null; ageGroup: AgeGroup };

export async function listChildren(parentId: string): Promise<Child[]> {
  return service()<Child[]>`
    select id, full_name as "fullName", age_group as "ageGroup"
    from profiles where guardian_id = ${parentId} order by created_at`;
}

/** Профиль ребёнка без почты и пароля: войти в него можно только из аккаунта родителя. */
export async function addChild(parent: Pick<CurrentUser, "id" | "locale" | "guardianId">, nameRaw: string, ageGroup: string): Promise<string | null> {
  const name = nameRaw.trim().slice(0, 60);
  if (parent.guardianId) return null; // ребёнок не может заводить детей
  if (name.length < 2 || (ageGroup !== "kids" && ageGroup !== "teens")) return null;
  const sql = service();
  return sql.begin(async (tx) => {
    const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from profiles where guardian_id = ${parent.id}`;
    if (n >= MAX_CHILDREN) return null;
    const id = randomUUID();
    await tx`
      insert into profiles (id, email, full_name, role, locale, guardian_id, age_group)
      values (${id}, ${`child-${id}@children.invalid`}, ${name}, 'student', ${parent.locale}, ${parent.id}, ${ageGroup})`;
    return id;
  }) as Promise<string | null>;
}

export async function isChildOf(parentId: string, childId: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(childId)) return false;
  const [r] = await service()`select 1 from profiles where id = ${childId} and guardian_id = ${parentId}`;
  return Boolean(r);
}

/** Родитель открывает кабинет ребёнка: сессия переключается на профиль ребёнка. */
export async function switchToChild(parentId: string, childId: string): Promise<boolean> {
  if (!(await isChildOf(parentId, childId))) return false;
  await startSession(childId);
  return true;
}

/** Возврат из детского кабинета к родителю только по паролю родителя: ребёнок не попадёт в платежи и настройки. */
export async function returnToParent(childId: string, password: string): Promise<boolean> {
  const sql = service();
  const [row] = await sql<{ guardian_id: string; password_hash: string | null }[]>`
    select c.guardian_id, k.password_hash
    from profiles c left join credentials k on k.user_id = c.guardian_id where c.id = ${childId} and c.guardian_id is not null`;
  const ok = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !row.password_hash || !ok) return false;
  await startSession(row.guardian_id);
  return true;
}

export async function isChildProfile(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const [r] = await service()`select 1 from profiles where id = ${userId} and guardian_id is not null`;
  return Boolean(r);
}
