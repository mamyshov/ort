import { NextResponse } from "next/server";
import { service } from "@/lib/db";
import { secretMatches } from "@/lib/secrets";

/** Бот получает «/start <id лида>» и запоминает чат: после этого ему можно писать напоминания. */
export async function POST(req: Request) {
  if (!secretMatches(req.headers.get("x-telegram-bot-api-secret-token"), process.env.TELEGRAM_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const u = await req.json().catch(() => null) as { message?: { text?: string; chat?: { id?: number } } } | null;
  const text = u?.message?.text ?? "";
  const chat = u?.message?.chat?.id;
  const m = /^\/start\s+([0-9a-f-]{36})$/i.exec(text);
  if (m && chat) {
    await service()`update leads set telegram_chat_id = ${String(chat)} where id = ${m[1]}`;
    await service()`insert into lead_events (lead_id, type) values (${m[1]}, 'telegram_linked')`;
  }
  return NextResponse.json({ ok: true });
}
