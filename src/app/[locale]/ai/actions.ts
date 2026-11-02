"use server";

import { getLocale } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import type { Msg } from "@/lib/ai";
import { flashcards, levelTest, lessonHelper, partner, salesBot, studyPlan, type Flashcard } from "@/lib/ai/features";

const UUID = /^[0-9a-f-]{36}$/i;

export type ChatState = { history: Msg[]; error?: string; mock?: boolean };

/** Историю присылает браузер, поэтому она проверяется: роли, длина, число сообщений. */
function readHistory(fd: FormData): Msg[] | null {
  const q = String(fd.get("message") ?? "").trim().slice(0, 1000);
  if (!q) return null;
  let prev: unknown = [];
  try { prev = JSON.parse(String(fd.get("history") ?? "[]")); } catch { /* пустая история */ }
  const h = (Array.isArray(prev) ? prev : [])
    .filter((m): m is Msg => !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-10).map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  return [...h, { role: "user", content: q }];
}

async function chat(fd: FormData, run: (h: Msg[], locale: string) => Promise<{ text: string; mock: boolean } | { error: string }>): Promise<ChatState> {
  const history = readHistory(fd);
  if (!history) return { history: [] };
  const r = await run(history, await getLocale());
  if ("error" in r) return { history: history.slice(0, -1).length ? history.slice(0, -1) : [], error: r.error };
  return { history: [...history, { role: "assistant", content: r.text }], mock: r.mock };
}

export async function salesChatAction(_: ChatState, fd: FormData) {
  return chat(fd, (h, l) => salesBot(h, l));
}

export async function partnerChatAction(_: ChatState, fd: FormData) {
  const u = await getCurrentUser();
  if (!u) return { history: [], error: "denied" };
  return chat(fd, (h, l) => partner(u.id, h, l));
}

export async function lessonChatAction(_: ChatState, fd: FormData) {
  const u = await getCurrentUser();
  const lid = String(fd.get("lessonId") ?? "");
  if (!u || !UUID.test(lid)) return { history: [], error: "denied" };
  return chat(fd, (h, l) => lessonHelper(u.id, lid, h, l));
}

export type CardsState = { cards?: Flashcard[]; error?: string; mock?: boolean } | null;

export async function flashcardsAction(_: CardsState, fd: FormData): Promise<CardsState> {
  const u = await getCurrentUser();
  const lid = String(fd.get("lessonId") ?? "");
  if (!u || !UUID.test(lid)) return { error: "denied" };
  const r = await flashcards(u.id, lid, await getLocale());
  return "error" in r ? { error: r.error } : { cards: r.cards, mock: r.mock };
}

export type TextState = { text?: string; error?: string; mock?: boolean; level?: string } | null;

export async function studyPlanAction(): Promise<TextState> {
  const u = await getCurrentUser();
  if (!u) return { error: "denied" };
  const r = await studyPlan(u.id, await getLocale());
  return "error" in r ? { error: r.error } : { text: r.text, mock: r.mock };
}

export async function levelTestAction(_: TextState, fd: FormData): Promise<TextState> {
  const text = String(fd.get("text") ?? "").trim();
  if (text.length < 10) return { error: "error" };
  const r = await levelTest(text, await getLocale());
  return "error" in r ? { error: r.error } : { text: r.advice, level: r.level, mock: r.mock };
}
