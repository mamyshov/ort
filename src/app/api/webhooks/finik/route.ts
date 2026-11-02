import { NextResponse } from "next/server";

/** Уведомления Finik. Подпись и формат нужно реализовать по документации Finik (см. src/lib/payments/finik.ts). */
export async function POST() {
  return NextResponse.json({ error: "not_implemented" }, { status: 501 });
}
