"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { tooMany } from "@/lib/ratelimit";
import { getCurrentUser } from "@/lib/auth";
import { isChildOf } from "@/lib/children";
import { currentLead } from "@/lib/funnel";
import { createOrder, type Method } from "@/lib/payments";

const METHODS = ["card", "finik", "elsom", "kaspi", "other"];

export async function checkoutAction(fd: FormData) {
  const locale = await getLocale();
  const slug = String(fd.get("slug") ?? "");
  const back = `/checkout/${encodeURIComponent(slug)}?error=1`;
  if (await tooMany("checkout", 15)) return redirect({ href: back, locale });
  const method = String(fd.get("method") ?? "");
  if (fd.get("terms") !== "on" || !METHODS.includes(method)) return redirect({ href: back, locale });
  const lead = await currentLead();
  const me = await getCurrentUser();
  if (me?.guardianId) return redirect({ href: back, locale });
  const childId = String(fd.get("childId") ?? "");
  let userId: string | null = null;
  if (childId) {
    if (!me || !(await isChildOf(me.id, childId))) return redirect({ href: back, locale });
    userId = childId; // доступ откроется ребёнку, оплачивает родитель
  }
  const res = await createOrder({
    packageSlug: slug, method: method as Method, locale, leadId: lead?.id ?? null, userId,
    name: String(fd.get("name") ?? ""), email: String(fd.get("email") ?? ""), phone: String(fd.get("phone") ?? ""),
  });
  if ("error" in res) return redirect({ href: back, locale });
  if (res.redirectUrl) return redirect({ href: res.redirectUrl, locale });
  return redirect({ href: `/pay/${res.orderRef}`, locale });
}
