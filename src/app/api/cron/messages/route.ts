import { NextResponse } from "next/server";
import { processQueue } from "@/lib/messaging";
import { bearer, secretMatches } from "@/lib/secrets";

/** Отправка очереди сообщений. Вызывать раз в минуту планировщиком хостинга с Authorization: Bearer <CRON_SECRET>. */
export async function GET(req: Request) {
  if (!secretMatches(bearer(req), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await processQueue(50));
}
