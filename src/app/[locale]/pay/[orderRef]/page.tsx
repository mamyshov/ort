import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FbPixel } from "@/components/fb-pixel";
import { btnCls, btnGhostCls } from "@/components/loc-fields";
import { SiteShell } from "@/components/site-shell";
import { loc } from "@/lib/content";
import { getOrder, mockEnabled, orderCode } from "@/lib/payments";
import { methodInfo } from "@/lib/payments/methods";
import { mockPayAction } from "../actions";

export default async function PayPage({ params }: PageProps<"/[locale]/pay/[orderRef]">) {
  const { locale, orderRef } = await params;
  setRequestLocale(locale);
  const order = await getOrder(orderRef);
  if (!order) notFound();
  const t = await getTranslations("Funnel.pay");
  const tm = await getTranslations("Funnel.method");
  const info = methodInfo(order.method);
  const done = order.status === "paid";
  return (
    <SiteShell>
      {done && !order.upsellOf && <FbPixel event="Purchase" value={order.amount} />}
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      <div className="rounded-3xl border border-zinc-200 bg-white shadow-card p-5">
        <p className="font-medium">{order.packageTitle ? loc(order.packageTitle, locale) : ""} · ${order.amount}</p>
        <p className={`mt-2 text-sm font-medium ${done ? "text-emerald-700" : order.status === "pending" ? "text-amber-700" : "text-red-700"}`}>
          {t(order.status)}
        </p>
      </div>
      {order.status === "pending" && (
        <>
          {info?.kind === "transfer" && (
            <p className="rounded-xl bg-zinc-100 p-4 text-sm">
              {t("transfer", { amount: `$${order.amount}`, to: info.to ?? "", method: tm(order.method), code: orderCode(order.orderRef) })}
            </p>
          )}
          {mockEnabled() && (
            <form action={mockPayAction}>
              <input type="hidden" name="orderRef" value={order.orderRef} />
              <button type="submit" className={btnCls}>{t("mock")}</button>
            </form>
          )}
          <a href="" className={`${btnGhostCls} text-center`}>{t("refresh")}</a>
        </>
      )}
      {done && (
        <a href={`/api/pay/enter?order=${order.orderRef}&locale=${locale}`} className={`${btnCls} text-center`}>{t("enter")}</a>
      )}
    </SiteShell>
  );
}
