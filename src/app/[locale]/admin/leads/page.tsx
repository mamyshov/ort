import { getTranslations, setRequestLocale } from "next-intl/server";
import { inputCls, btnGhostCls } from "@/components/loc-fields";
import { listLeads, listMessages } from "@/lib/admin";
import { requireRole } from "@/lib/guards";
import { AiButton } from "@/components/ai-button";
import { setLeadStatusAction } from "../actions";
import { crmHintAction } from "../ai-actions";

const STATUSES = ["registered", "joined_group", "attended", "purchased", "lost"] as const;

export default async function LeadsPage({ params, searchParams }: PageProps<"/[locale]/admin/leads">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole(locale, ["owner", "manager"]);
  const t = await getTranslations("Admin");
  const [leads, messages] = await Promise.all([listLeads(user.id), listMessages(user.id)]);
  const failed = (await searchParams).error;
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" });
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-extrabold">{t("leads.title")}</h1>
        {failed && <p role="alert" className="text-sm text-red-600">{t("common.error")}</p>}
        {leads.length === 0 && <p className="text-zinc-600">{t("leads.empty")}</p>}
        <ul className="flex flex-col gap-2">
          {leads.map((l) => (
            <li key={l.id} className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{l.name ?? "—"}</div>
                  <div className="text-sm text-zinc-500">{[l.phone, l.email].filter(Boolean).join(" · ")}</div>
                  <div className="text-xs text-zinc-400">{t("leads.source")}: {l.source ?? "—"} · {fmt.format(l.createdAt)}</div>
                </div>
                <form action={setLeadStatusAction} className="flex gap-2">
                  <input type="hidden" name="id" value={l.id} />
                  <select name="status" defaultValue={l.status} className={inputCls} aria-label={t("payments.statusLabel")}>
                    {STATUSES.map((s) => <option key={s} value={s}>{t(`leads.status.${s}`)}</option>)}
                  </select>
                  <button type="submit" className={btnGhostCls}>{t("common.save")}</button>
                </form>
              </div>
              <div className="mt-3"><AiButton action={crmHintAction} label={t("ai.hint")} fields={{ leadId: l.id }} /></div>
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-extrabold">{t("messages.title")}</h2>
        {messages.length === 0 && <p className="text-sm text-zinc-500">{t("messages.empty")}</p>}
        <div className="overflow-x-auto rounded-3xl border border-zinc-200 bg-white shadow-card">
          <table className="w-full text-left text-sm">
            <tbody>
              {messages.map((m) => (
                <tr key={m.id} className="border-b border-zinc-100 last:border-0">
                  <td className="whitespace-nowrap p-3">{fmt.format(m.createdAt)}</td>
                  <td className="p-3">{m.channel} · {m.to}</td>
                  <td className="p-3 font-mono text-xs">{m.template}</td>
                  <td className="p-3">{t(`messages.${m.status as "queued" | "sent" | "failed" | "cancelled"}`)}
                    {m.error && <div className="text-xs text-zinc-500">{m.error}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
