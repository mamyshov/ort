"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { tooMany } from "@/lib/ratelimit";
import { getCurrentUser } from "@/lib/auth";
import { createOrder, type Method } from "@/lib/payments";

const METHODS = ["card", "finik", "elsom", "kaspi", "other"];

export async function checkoutAction(fd: FormData) {
  const locale = await getLocale();
  const slug = String(fd.get("slug") ?? "");
  const back = `/checkout/${encodeURIComponent(slug)}?error=1`;
  if (await tooMany("checkout", 15)) return redirect({ href: back, locale });
  const method = String(fd.get("method") ?? "");
  if (fd.get("terms") !== "on" || !METHODS.includes(method)) return redirect({ href: back, locale });
  const me = await getCurrentUser();
  const res = await createOrder({
    packageSlug: slug, method: method as Method, locale, userId: me?.id ?? null,
    name: String(fd.get("name") ?? ""), email: String(fd.get("email") ?? ""), phone: String(fd.get("phone") ?? ""),
  });
  if ("error" in res) return redirect({ href: back, locale });
  if (res.redirectUrl) return redirect({ href: res.redirectUrl, locale });
  return redirect({ href: `/pay/${res.orderRef}`, locale });
}
