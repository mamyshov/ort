import { getTranslations, setRequestLocale } from "next-intl/server";
import { btnCls, inputCls, LocFields } from "@/components/loc-fields";
import { withUser } from "@/lib/db";
import { loc, type Localized } from "@/lib/content";
import { requireRole } from "@/lib/guards";
import { savePackageAction } from "../actions";

type Pkg = { id: string; slug: string; title: Localized; priceUsd: number; accessDays: number; isActive: boolean };

export default async function PackagesPage({ params }: PageProps<"/[locale]/admin/packages">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole(locale, ["owner"]);
  const t = await getTranslations("Admin.packages");
  const rows = await withUser(user.id, (tx) => tx<Pkg[]>`select id, slug, title, price_usd::float as "priceUsd", access_days as "accessDays", is_active as "isActive" from packages order by price_usd`);
  const form = (p?: Pkg) => (
    <form action={savePackageAction} className="flex flex-col gap-3">
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs font-bold">{t("slug")}<input name="slug" defaultValue={p?.slug} required className={inputCls} /></label>
        <label className="flex flex-col gap-1 text-xs font-bold">{t("price")}<input name="priceUsd" type="number" step="0.01" min={0} defaultValue={p?.priceUsd ?? 0} className={inputCls} /></label>
        <label className="flex flex-col gap-1 text-xs font-bold">{t("days")}<input name="accessDays" type="number" min={1} defaultValue={p?.accessDays ?? 30} className={inputCls} /></label>
        <label className="flex items-center gap-2 pt-5 text-sm font-bold"><input type="checkbox" name="isActive" defaultChecked={p?.isActive ?? true} />{t("active")}</label>
      </div>
      <LocFields name="title" label={t("name")} value={p?.title} />
      <button className={btnCls + " self-start"}>{t("save")}</button>
    </form>
  );
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      <p className="text-sm text-zinc-600">{t("hint")}</p>
      {rows.map((p) => <section key={p.id} className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-card"><h2 className="mb-3 text-lg font-extrabold">{loc(p.title, locale)}</h2>{form(p)}</section>)}
      <section className="rounded-3xl border-2 border-dashed border-zinc-300 p-5"><h2 className="mb-3 text-lg font-extrabold">{t("new")}</h2>{form()}</section>
    </div>
  );
}
