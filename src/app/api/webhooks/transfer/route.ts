import { NextResponse } from "next/server";
import { confirmTransfer } from "@/lib/payments";
import { bearer, secretMatches } from "@/lib/secrets";

/**
 * Автоподтверждение переводов ЭЛСОМ и Kaspi. Сюда присылает уведомление о входящем переводе
 * то, что читает банковские СМС или API (приложение-пересыльщик, банк, посредник).
 * Тело: { method: "elsom"|"kaspi", code, amount, currency, txId }. Заголовок: Authorization: Bearer <TRANSFER_WEBHOOK_SECRET>.
 */
export async function POST(req: Request) {
  if (!secretMatches(bearer(req), process.env.TRANSFER_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const b = await req.json().catch(() => null) as Record<string, unknown> | null;
  const method = b?.method;
  const amount = Number(b?.amount);
  if ((method !== "elsom" && method !== "kaspi") || !Number.isFinite(amount) || amount <= 0
      || typeof b?.code !== "string" || typeof b?.txId !== "string" || !b.txId) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const result = await confirmTransfer({
    method, code: b.code, amount, currency: typeof b.currency === "string" ? b.currency : "KGS", txId: b.txId,
  });
  // duplicate — повтор того же уведомления, для отправителя это успех
  return NextResponse.json({ result }, { status: result === "settled" || result === "duplicate" ? 200 : 422 });
}
