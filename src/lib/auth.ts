import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import type { UiLocale } from "@/i18n/locales";
import { service } from "./db";
import { DUMMY_HASH, hashPassword, verifyPassword } from "./passwords";

export type Role = "student" | "manager" | "teacher" | "owner";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: Role;
  locale: UiLocale;
  /** Если это профиль ребёнка: кто родитель и возрастная группа */
  guardianId: string | null;
  ageGroup: "kids" | "teens" | null;
};

const COOKIE = "session";
const SESSION_DAYS = 30;
const MAX_FAILED_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MINUTES = 15;
export const MIN_PASSWORD_LENGTH = 8;

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const isStaff = (role: Role) => role !== "student";

export async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
  await service()`
    insert into sessions (user_id, token_hash, expires_at)
    values (${userId}, ${sha256(token)}, ${expires})`;
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export type LoginResult =
  | { ok: true; user: CurrentUser }
  | { ok: false; reason: "invalid" | "throttled" };

export async function login(emailRaw: string, password: string): Promise<LoginResult> {
  const email = normalizeEmail(emailRaw);
  const sql = service();

  const [{ failed }] = await sql<{ failed: number }[]>`
    select count(*)::int as failed from login_attempts
    where lower(email) = ${email} and success = false
      and at > now() - make_interval(mins => ${ATTEMPT_WINDOW_MINUTES})`;
  if (failed >= MAX_FAILED_ATTEMPTS) return { ok: false, reason: "throttled" };

  const [row] = await sql<
    { id: string; email: string; full_name: string | null; role: Role; locale: CurrentUser["locale"]; password_hash: string }[]
  >`
    select p.id, p.email, p.full_name, p.role, p.locale, c.password_hash
    from profiles p join credentials c on c.user_id = p.id
    where lower(p.email) = ${email}`;

  const valid = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
  await sql`insert into login_attempts (email, success) values (${email}, ${Boolean(row) && valid})`;
  if (!row || !valid) return { ok: false, reason: "invalid" };

  await startSession(row.id);
  return {
    ok: true,
    user: { id: row.id, email: row.email, fullName: row.full_name, role: row.role, locale: row.locale, guardianId: null, ageGroup: null },
  };
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await service()`delete from sessions where token_hash = ${sha256(token)}`;
  jar.delete(COOKIE);
}

/** Текущий пользователь по cookie сессии. Результат кэшируется на время одного запроса. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [row] = await service()<
    { id: string; email: string; full_name: string | null; role: Role; locale: CurrentUser["locale"];
      guardian_id: string | null; age_group: "kids" | "teens" | null }[]
  >`
    select p.id, p.email, p.full_name, p.role, p.locale, p.guardian_id, p.age_group
    from sessions s join profiles p on p.id = s.user_id
    where s.token_hash = ${sha256(token)} and s.expires_at > now()`;
  return row
    ? { id: row.id, email: row.email, fullName: row.full_name, role: row.role, locale: row.locale,
        guardianId: row.guardian_id, ageGroup: row.age_group }
    : null;
});

export type NewUser = {
  email: string;
  password: string;
  fullName?: string | null;
  phone?: string | null;
  role?: Role;
  locale?: CurrentUser["locale"];
};

/** Создаёт пользователя. Если почта уже занята, возвращает null. */
export async function createUser(input: NewUser): Promise<string | null> {
  if (input.password.length < MIN_PASSWORD_LENGTH) throw new Error("Пароль слишком короткий");
  const email = normalizeEmail(input.email);
  const hash = await hashPassword(input.password);
  return service().begin(async (tx) => {
    const [exists] = await tx`select 1 from profiles where lower(email) = ${email}`;
    if (exists) return null;
    const [p] = await tx<{ id: string }[]>`
      insert into profiles (email, full_name, phone, role, locale)
      values (${email}, ${input.fullName ?? null}, ${input.phone ?? null},
              ${input.role ?? "student"}, ${input.locale ?? "ru"})
      returning id`;
    await tx`insert into credentials (user_id, password_hash) values (${p.id}, ${hash})`;
    return p.id;
  }) as Promise<string | null>;
}

export async function setPassword(userId: string, password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) throw new Error("Пароль слишком короткий");
  const hash = await hashPassword(password);
  await service().begin(async (tx) => {
    await tx`
      insert into credentials (user_id, password_hash) values (${userId}, ${hash})
      on conflict (user_id) do update set password_hash = excluded.password_hash, updated_at = now()`;
    // Смена пароля завершает все остальные сессии
    await tx`delete from sessions where user_id = ${userId}`;
  });
}

/** Создаёт одноразовую ссылку для сброса пароля. Токен нужно отправить пользователю. */
export async function createPasswordReset(emailRaw: string): Promise<{ token: string; userId: string } | null> {
  const email = normalizeEmail(emailRaw);
  const [user] = await service()<{ id: string }[]>`select id from profiles where lower(email) = ${email}`;
  if (!user) return null;
  const token = randomBytes(32).toString("base64url");
  await service()`
    insert into password_resets (token_hash, user_id, expires_at)
    values (${sha256(token)}, ${user.id}, now() + interval '1 hour')`;
  return { token, userId: user.id };
}

export async function consumePasswordReset(token: string, newPassword: string): Promise<boolean> {
  const hash = sha256(token);
  const [row] = await service()<{ user_id: string }[]>`
    update password_resets set used_at = now()
    where token_hash = ${hash} and used_at is null and expires_at > now()
    returning user_id`;
  if (!row) return false;
  await setPassword(row.user_id, newPassword);
  return true;
}

/** Смена пароля самим пользователем. Текущая сессия сохраняется, остальные завершаются. */
export async function changePassword(
  userId: string,
  current: string,
  next: string,
): Promise<"ok" | "wrong" | "short"> {
  if (next.length < MIN_PASSWORD_LENGTH) return "short";
  const [c] = await service()<{ password_hash: string }[]>`
    select password_hash from credentials where user_id = ${userId}`;
  if (!c || !(await verifyPassword(current, c.password_hash))) return "wrong";
  const token = (await cookies()).get(COOKIE)?.value;
  const hash = await hashPassword(next);
  await service().begin(async (tx) => {
    await tx`update credentials set password_hash = ${hash}, updated_at = now() where user_id = ${userId}`;
    await tx`delete from sessions where user_id = ${userId} and token_hash <> ${token ? sha256(token) : ""}`;
  });
  return "ok";
}

export const googleEnabled = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

/**
 * Вход через Google по подтверждённой почте. Новому человеку создаётся аккаунт ученика.
 * Сотрудники (не ученики) входят только по паролю: так чужая почта не даст доступ к админке.
 */
export async function signInWithGoogle(input: { email: string; name: string | null; locale: string }) {
  const email = normalizeEmail(input.email);
  const [row] = await service()<{ id: string; role: Role }[]>`select id, role from profiles where lower(email) = ${email}`;
  if (row) {
    if (row.role !== "student") return { ok: false as const, reason: "staff" as const };
    await startSession(row.id);
    return { ok: true as const, created: false };
  }
  const locale = (["ru", "ky", "en", "uz", "kk", "es", "pt", "tr"] as const).find((l) => l === input.locale) ?? "ru";
  const id = await createUser({
    email, password: randomBytes(24).toString("base64url"), fullName: input.name?.trim().slice(0, 120) || null, role: "student", locale,
  });
  if (!id) return { ok: false as const, reason: "failed" as const };
  await startSession(id);
  return { ok: true as const, created: true };
}
