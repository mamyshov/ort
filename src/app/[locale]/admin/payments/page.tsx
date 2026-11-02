import { getTranslations, setRequestLocale } from "next-intl/server";
import { btnGhostCls } from "@/components/loc-fields";
import { loc } from "@/lib/content";
import { listPayments } from "@/lib/admin";
import { requireRole } from "@/lib/guards";
import { confirmPaymentAction, refundAction } from "../actions";

export default async function PaymentsPage({ params, searchParams }: PageProps<"/[locale]/admin/payments">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole(locale, ["owner", "manager"]);
  const t = await getTranslations("Admin");
  const rows = await listPayments(user.id);
  const failed = (await searchParams).error;
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" });
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold">{t("payments.title")}</h1>
      {failed && <p role="alert" className="text-sm text-red-600">{t("common.error")}</p>}
      {rows.length === 0 && <p className="text-zinc-600">{t("payments.empty")}</p>}
      <div className="overflow-x-auto rounded-3xl border border-zinc-200 bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-zinc-500">
            <tr><th className="p-3">{t("payments.date")}</th><th className="p-3">{t("payments.buyer")}</th>
              <th className="p-3">{t("payments.amount")}</th><th className="p-3">{t("payments.method")}</th>
              <th className="p-3">{t("payments.statusLabel")}</th><th className="p-3" /></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-zinc-100 last:border-0">
                <td className="whitespace-nowrap p-3">{fmt.format(r.createdAt)}</td>
                <td className="p-3">{r.buyer}<div className="text-xs text-zinc-500">{r.packageTitle ? loc(r.packageTitle, locale) : ""} {r.email}</div></td>
                <td className="p-3">${r.amount}</td>
                <td className="p-3">{r.method}</td>
                <td className="p-3">{t(`payments.status.${r.status}`)}</td>
                <td className="p-3">
                  {(r.status === "pending" || r.status === "failed") && (
                    <form action={confirmPaymentAction}><input type="hidden" name="id" value={r.id} />
                      <button type="submit" className={btnGhostCls}>{t("payments.confirm")}</button></form>
                  )}
                  {r.status === "paid" && (
                    <form action={refundAction}><input type="hidden" name="id" value={r.id} />
                      <button type="submit" className={btnGhostCls}>{t("payments.refund")}</button></form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
