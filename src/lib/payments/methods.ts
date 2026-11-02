import "server-only";
import { isDemoSite } from "../demo";

export type Method = "card" | "finik" | "elsom" | "kaspi" | "other";

/** Как принимается каждый способ оплаты. Список строится из того, что реально настроено. */
export type MethodInfo = { method: Method; kind: "mock" | "transfer" | "redirect"; to?: string };

/** Тестовая оплата: только в пробном режиме (см. src/lib/demo.ts). */
export const mockEnabled = () => process.env.PAYMENTS_MOCK === "1" && isDemoSite();

export function availableMethods(): MethodInfo[] {
  if (mockEnabled()) {
    return (["card", "finik", "elsom", "kaspi"] as Method[]).map((method) => ({ method, kind: "mock" as const }));
  }
  const list: MethodInfo[] = [];
  // Finik: нужен договор и описание API от Finik; до этого способ не показывается покупателям
  if (process.env.FINIK_API_KEY && process.env.FINIK_API_URL) list.push({ method: "finik", kind: "redirect" });
  if (process.env.ELSOM_PHONE) list.push({ method: "elsom", kind: "transfer", to: process.env.ELSOM_PHONE });
  if (process.env.KASPI_PHONE) list.push({ method: "kaspi", kind: "transfer", to: process.env.KASPI_PHONE });
  return list;
}

export const methodInfo = (m: Method) => availableMethods().find((x) => x.method === m);

/** Курс для переводов в местной валюте (сомов за доллар). */
export const kgsPerUsd = () => Number(process.env.KGS_PER_USD) || null;
