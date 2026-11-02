import { getTranslations, setRequestLocale } from "next-intl/server";
import { btnCls, inputCls, LocFields } from "@/components/loc-fields";
import { adminMocks, adminSections, type MockAdmin } from "@/lib/admin";
import { loc } from "@/lib/content";
import { requireRole } from "@/lib/guards";
import { saveMockAction } from "../actions";

export default async function MocksPage({ params }: PageProps<"/[locale]/admin/mocks">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole(locale, ["owner"]);
  const t = await getTranslations("Admin.mocks");
  const [mocks, sections] = await Promise.all([adminMocks(user.id), adminSections(user.id)]);
  const form = (m?: MockAdmin) => (
    <form action={saveMockAction} className="flex flex-col gap-3">
      {m && <input type="hidden" name="id" value={m.id} />}
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs font-bold">{t("slug")}<input name="slug" defaultValue={m?.slug} required className={inputCls} /></label>
        <label className="flex flex-col gap-1 text-xs font-bold">{t("duration")}<input name="durationMin" type="number" min={1} defaultValue={m?.durationMin ?? 120} className={inputCls} /></label>
        <label className="flex items-center gap-2 pt-5 text-sm font-bold"><input type="checkbox" name="isFree" defaultChecked={m?.isFree} />{t("free")}</label>
        <label className="flex items-center gap-2 pt-5 text-sm font-bold"><input type="checkbox" name="isPublished" defaultChecked={m?.isPublished} />{t("published")}</label>
      </div>
      <LocFields name="title" label={t("name")} value={m?.title} />
      <fieldset className="flex flex-col gap-2"><legend className="mb-1 text-sm font-bold">{t("parts")}</legend>
        {sections.map((s) => (
          <label key={s.id} className="flex items-center gap-3 text-sm">
            <input type="hidden" name="partSection" value={s.id} />
            <input name="partCount" type="number" min={0} defaultValue={m?.parts.find((p) => p.sectionId === s.id)?.count ?? 0} className={inputCls + " !w-24"} />
            {loc(s.title, locale)}
          </label>
        ))}
      </fieldset>
      <button className={btnCls + " self-start"}>{t("save")}</button>
    </form>
  );
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      <p className="text-sm text-zinc-600">{t("hint")}</p>
      {mocks.map((m) => <section key={m.id} className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-card"><h2 className="mb-3 text-lg font-extrabold">{loc(m.title, locale)}</h2>{form(m)}</section>)}
      <section className="rounded-3xl border-2 border-dashed border-zinc-300 p-5"><h2 className="mb-3 text-lg font-extrabold">{t("new")}</h2>{form()}</section>
    </div>
  );
}
