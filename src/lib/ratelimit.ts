import "server-only";
import { headers } from "next/headers";

const hits = new Map<string, number[]>();

/**
 * Простое ограничение частоты для публичных форм: не больше `max` запросов с одного адреса за `windowSec`.
 * Хранится в памяти процесса, поэтому работает для одного сервера. При нескольких серверах вынести в базу.
 */
export async function tooMany(key: string, max = 10, windowSec = 600): Promise<boolean> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  const k = `${key}:${ip}`;
  const now = Date.now();
  const list = (hits.get(k) ?? []).filter((t) => now - t < windowSec * 1000);
  list.push(now);
  hits.set(k, list);
  if (hits.size > 5000) for (const [kk, v] of hits) if (v.every((t) => now - t > windowSec * 1000)) hits.delete(kk);
  return list.length > max;
}
