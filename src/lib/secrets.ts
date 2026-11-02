import "server-only";
import { timingSafeEqual } from "node:crypto";

/** Сравнение секретов за постоянное время. Пустой секрет в настройках никогда не совпадает. */
export function secretMatches(given: string | null | undefined, expected: string | undefined): boolean {
  if (!given || !expected) return false;
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const bearer = (req: Request) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
