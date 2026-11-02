"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createOrder, getOrder } from "@/lib/payments";
import { service } from "@/lib/db";

export async function upsellAction(fd: FormData) {
  const locale = await getLocale();
  const orig = await getOrder(String(fd.get("order") ?? ""));
  const slug = String(fd.get("slug") ?? "");
  if (!orig || orig.status !== "paid" || !orig.userId) return redirect({ href: "/login", locale });
  const [u] = await service()<{ phone: string | null }[]>`select phone from profiles where id = ${orig.userId}`;
  const res = await createOrder({
    packageSlug: slug, method: orig.method, locale, userId: orig.userId, upsellOf: orig.id,
    name: orig.payerName ?? "", email: orig.payerEmail ?? "", phone: u?.phone ?? "",
  });
  if ("error" in res) return redirect({ href: "/app", locale });
  return redirect({ href: res.redirectUrl ?? `/pay/${res.orderRef}`, locale });
}
