"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { crmHint, gradingDraft, ownerSummary, quizQuestions, translateMissing } from "@/lib/ai/features";
import { audit } from "@/lib/admin";
import type { TextState } from "../ai/actions";

const UUID = /^[0-9a-f-]{36}$/i;
async function role(...r: CurrentUser["role"][]) {
  const u = await getCurrentUser();
  return u && r.includes(u.role) ? u : null;
}
const val = (fd: FormData, k: string) => { const v = String(fd.get(k) ?? ""); return UUID.test(v) ? v : null; };

export async function gradingDraftAction(fd: FormData) {
  const u = await role("owner", "teacher");
  const sid = val(fd, "id");
  const ok = !!u && !!sid && await gradingDraft(u.id, sid, await getLocale());
  revalidatePath("/admin/reviews", "page");
  return redirect({ href: ok ? "/admin/reviews" : "/admin/reviews?error=1", locale: await getLocale() });
}

export async function quizGenAction(fd: FormData) {
  const u = await role("owner", "teacher");
  const lid = val(fd, "lessonId");
  const locale = await getLocale();
  const path = `/admin/lessons/${lid}/quiz`;
  if (!u || !lid) return redirect({ href: "/admin", locale });
  const qs = await quizQuestions(u.id, lid, locale);
  if (!Array.isArray(qs) || qs.length === 0) return redirect({ href: `${path}?error=1`, locale });
  try {
    await withUser(u.id, async (tx) => {
      for (const q of qs) {
        const options = q.options.slice(0, 6).map((text, i) => ({ id: String.fromCharCode(97 + i), text: { ru: String(text).slice(0, 300) } }));
        await tx`insert into quiz_questions (lesson_id, position, prompt, options, correct_option)
                 values (${lid}, coalesce((select max(position) from quiz_questions where lesson_id = ${lid}), 0) + 1,
                         ${tx.json({ ru: q.prompt.slice(0, 500) })}, ${tx.json(options)}, ${String.fromCharCode(96 + q.correct)})`;
      }
      await audit(tx, u.id, "quiz.ai_generate", "lesson", lid, { count: qs.length });
    });
  } catch {
    return redirect({ href: `${path}?error=1`, locale });
  }
  revalidatePath(path, "page");
  return redirect({ href: path, locale });
}

export async function crmHintAction(_: TextState, fd: FormData): Promise<TextState> {
  const u = await role("owner", "manager");
  const lid = val(fd, "leadId");
  if (!u || !lid) return { error: "denied" };
  const r = await crmHint(u.id, lid, await getLocale());
  return "error" in r ? { error: r.error } : { text: r.text, mock: r.mock };
}

export async function ownerSummaryAction(): Promise<TextState> {
  const u = await role("owner");
  if (!u) return { error: "denied" };
  const r = await ownerSummary(u.id, await getLocale());
  return "error" in r ? { error: r.error } : { text: r.text, mock: r.mock };
}

export async function translateAction(fd: FormData) {
  const u = await role("owner", "teacher");
  const lid = val(fd, "id");
  const locale = await getLocale();
  const ok = !!u && !!lid && await translateMissing(u.id, lid);
  if (ok && u && lid) await withUser(u.id, (tx) => audit(tx, u.id, "lesson.ai_translate", "lesson", lid));
  revalidatePath(`/admin/lessons/${lid}`, "page");
  return redirect({ href: `/admin/lessons/${lid}${ok ? "" : "?error=1"}`, locale });
}
