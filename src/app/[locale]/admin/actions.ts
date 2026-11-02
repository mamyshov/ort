"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import * as admin from "@/lib/admin";
import { importQuestions, parseCsv, type ImportItem, type ImportReport } from "@/lib/questions";
import { refundPayment } from "@/lib/payments";
import type { Localized } from "@/lib/content";

async function staff(roles: ("owner" | "manager")[]): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u || !roles.includes(u.role as "owner" | "manager")) throw new Error("forbidden");
  return u;
}
const owner = () => staff(["owner"]);
const anyStaff = () => staff(["owner", "manager"]);

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const loc2 = (fd: FormData, base: string): Localized => {
  const o: Localized = {};
  for (const l of ["ru", "ky"] as const) { const v = text(fd, `${base}_${l}`); if (v) o[l] = v; }
  return o;
};
const uuid = (v: string) => (/^[0-9a-f-]{36}$/.test(v) ? v : null);

/* ---------- Вопросы ---------- */
export async function saveQuestionAction(fd: FormData) {
  const locale = await getLocale();
  const u = await owner();
  const id = uuid(text(fd, "id")) ?? undefined;
  const options: { id: string; text: Localized }[] = [];
  for (const oid of ["a", "b", "c", "d", "e", "f"]) {
    const t = loc2(fd, `opt_${oid}`);
    if (Object.keys(t).length) options.push({ id: oid, text: t });
  }
  const correct = text(fd, "correct");
  const res = await admin.saveQuestion(u.id, {
    id, sectionId: text(fd, "sectionId"), topicId: uuid(text(fd, "topicId")),
    passage: Object.keys(loc2(fd, "passage")).length ? loc2(fd, "passage") : null, prompt: loc2(fd, "prompt"),
    options, difficulty: Math.min(3, Math.max(1, Number(fd.get("difficulty")) || 2)), isFree: fd.get("isFree") === "on",
    wantPublish: fd.get("publish") === "on", correct: options.some((o) => o.id === correct) ? correct : null, explanation: loc2(fd, "explanation"),
  });
  if ("error" in res) return redirect({ href: `/admin/questions/${id ?? "new"}?error=${res.error}`, locale });
  return redirect({ href: `/admin/questions/${res.id}?saved=1`, locale });
}

export async function publishAction(fd: FormData) {
  const u = await owner();
  const ok = await admin.setPublished(u.id, text(fd, "id"), fd.get("on") === "1");
  revalidatePath("/", "layout");
  if (!ok) return redirect({ href: "/admin/questions?error=1", locale: await getLocale() });
}

export async function deleteQuestionAction(fd: FormData) {
  const u = await owner();
  await admin.deleteQuestion(u.id, text(fd, "id"));
  return redirect({ href: "/admin/questions", locale: await getLocale() });
}

/* ---------- Загрузка ---------- */
export type ImportState = { report: ImportReport; dryRun: boolean } | { parseError: true } | null;

export async function importAction(_p: ImportState, fd: FormData): Promise<ImportState> {
  const u = await owner();
  let body = text(fd, "body");
  const file = fd.get("file");
  if (file instanceof File && file.size > 0 && file.size < 5_000_000) body = (await file.text()).replace(/^﻿/, "");
  const dryRun = fd.get("dryRun") === "on";
  let items: ImportItem[];
  try {
    items = body.trimStart().startsWith("[") || body.trimStart().startsWith("{")
      ? (() => { const j = JSON.parse(body); return Array.isArray(j) ? j : [j]; })()
      : parseCsv(body);
  } catch {
    return { parseError: true };
  }
  if (!items.length || items.length > 2000) return { parseError: true };
  const report = await importQuestions(u.id, items, { dryRun });
  revalidatePath("/", "layout");
  return { report, dryRun };
}

/* ---------- Разделы, темы, тесты, пакеты ---------- */
export async function saveSectionAction(fd: FormData) {
  const u = await owner();
  await admin.saveSection(u.id, {
    id: uuid(text(fd, "id")) ?? undefined, slug: text(fd, "slug").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40) || "section",
    kind: ["main", "kyrgyz", "russian", "subject"].includes(text(fd, "kind")) ? text(fd, "kind") : "subject",
    title: loc2(fd, "title"), position: Number(fd.get("position")) || 0, isPublished: fd.get("isPublished") === "on",
  });
  revalidatePath("/", "layout");
}

export async function saveTopicAction(fd: FormData) {
  const u = await owner();
  const sectionId = uuid(text(fd, "sectionId"));
  if (!sectionId) return;
  await admin.saveTopic(u.id, { id: uuid(text(fd, "id")) ?? undefined, sectionId, title: loc2(fd, "title"), position: Number(fd.get("position")) || 0 });
  revalidatePath("/", "layout");
}

export async function saveMockAction(fd: FormData) {
  const u = await owner();
  const sections = (fd.getAll("partSection") as string[]).map((s, i) => ({ sectionId: s, count: Math.floor(Number(fd.getAll("partCount")[i]) || 0) }));
  await admin.saveMock(u.id, {
    id: uuid(text(fd, "id")) ?? undefined, slug: text(fd, "slug").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40) || "mock",
    title: loc2(fd, "title"), durationMin: Math.max(1, Math.floor(Number(fd.get("durationMin")) || 60)),
    isFree: fd.get("isFree") === "on", isPublished: fd.get("isPublished") === "on", parts: sections.filter((p) => uuid(p.sectionId)),
  });
  revalidatePath("/", "layout");
}

export async function savePackageAction(fd: FormData) {
  const u = await owner();
  const id = uuid(text(fd, "id"));
  const slug = text(fd, "slug").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40) || "premium";
  const price = Math.max(0, Number(fd.get("priceUsd")) || 0);
  const days = Math.max(1, Math.floor(Number(fd.get("accessDays")) || 30));
  await withUser(u.id, async (tx) => {
    const title = tx.json(loc2(fd, "title") as never);
    if (id) await tx`update packages set slug = ${slug}, title = ${title}, price_usd = ${price}, access_days = ${days}, is_active = ${fd.get("isActive") === "on"} where id = ${id}`;
    else await tx`insert into packages (slug, title, price_usd, access_days, is_active) values (${slug}, ${title}, ${price}, ${days}, ${fd.get("isActive") === "on"})`;
    await tx`insert into audit_log (actor_id, action, entity, entity_id) values (${u.id}, 'package.save', 'package', ${id})`;
  });
  revalidatePath("/", "layout");
}

/* ---------- Ученики и платежи ---------- */
export async function grantAction(fd: FormData) {
  const u = await anyStaff();
  const id = uuid(text(fd, "id"));
  if (id) await admin.grantAccess(u.id, id, Number(fd.get("days")) || 30);
  revalidatePath("/", "layout");
}

export async function revokeAction(fd: FormData) {
  const u = await anyStaff();
  const id = uuid(text(fd, "id"));
  if (id) await admin.revokeAccess(u.id, id);
  revalidatePath("/", "layout");
}

export async function confirmPaymentAction(fd: FormData) {
  const u = await anyStaff();
  const ok = await admin.confirmPayment(u.id, text(fd, "id"));
  revalidatePath("/", "layout");
  if (!ok) return redirect({ href: "/admin/payments?error=1", locale: await getLocale() });
}

export async function refundAction(fd: FormData) {
  const u = await anyStaff();
  const ok = await refundPayment(u.id, text(fd, "id"));
  revalidatePath("/", "layout");
  if (!ok) return redirect({ href: "/admin/payments?error=1", locale: await getLocale() });
}
