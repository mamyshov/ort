"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { mockEnabled, settlePayment } from "@/lib/payments";

/** Тестовая оплата: работает только при PAYMENTS_MOCK=1 вне production. Проходит тот же путь, что и настоящее уведомление. */
export async function mockPayAction(fd: FormData) {
  const locale = await getLocale();
  const ref = String(fd.get("orderRef") ?? "");
  if (mockEnabled() && /^[0-9a-f]{32}$/.test(ref)) await settlePayment(ref, `mock-${ref}`);
  return redirect({ href: `/pay/${ref}`, locale });
}
