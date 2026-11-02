"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import { addChild, returnToParent, switchToChild } from "@/lib/children";
import { tooMany } from "@/lib/ratelimit";

export type ChildFormState = { error: "invalid" | "limit" } | { ok: true } | null;

export async function addChildAction(_p: ChildFormState, fd: FormData): Promise<ChildFormState> {
  const user = await getCurrentUser();
  if (!user || user.guardianId) return { error: "invalid" };
  if (await tooMany("addchild", 10)) return { error: "limit" };
  const id = await addChild(user, String(fd.get("name") ?? ""), String(fd.get("ageGroup") ?? ""));
  return id ? { ok: true } : { error: "invalid" };
}

export async function openChildAction(fd: FormData) {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user || user.guardianId) return redirect({ href: "/login", locale });
  const ok = await switchToChild(user.id, String(fd.get("childId") ?? ""));
  return redirect({ href: ok ? "/app" : "/app/children", locale });
}

export type ReturnState = { error: "wrong" | "limit" } | null;

export async function returnToParentAction(_p: ReturnState, fd: FormData): Promise<ReturnState> {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user || !user.guardianId) return redirect({ href: "/app", locale });
  if (await tooMany("parentpw", 8)) return { error: "limit" };
  const ok = await returnToParent(user.id, String(fd.get("password") ?? ""));
  if (!ok) return { error: "wrong" };
  return redirect({ href: "/app/children", locale });
}
