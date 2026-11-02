import { NextResponse, type NextRequest } from "next/server";
import { isUiLocale } from "@/i18n/locales";
import { startSession } from "@/lib/auth";
import { getOrder } from "@/lib/payments";

/**
 * Вход покупателя после оплаты. Пропуск — номер заказа: 128 случайных бит, он известен только покупателю.
 */
export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("order") ?? "";
  const wanted = req.nextUrl.searchParams.get("locale");
  const locale = isUiLocale(wanted) ? wanted : "ru";
  const order = await getOrder(ref);
  if (!order || order.status !== "paid" || !order.userId) return NextResponse.redirect(new URL(`/${locale}/login`, req.url));
  await startSession(order.userId);
  return NextResponse.redirect(new URL(`/${locale}/app`, req.url));
}
