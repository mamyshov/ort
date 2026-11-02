import { getTranslations, setRequestLocale } from "next-intl/server";
import { btnCls, btnGhostCls, inputCls, LocFields } from "@/components/loc-fields";
import { adminSections, adminTopics } from "@/lib/admin";
import { loc } from "@/lib/content";
import { requireRole } from "@/lib/guards";
import { saveSectionAction, saveTopicAction } from "../actions";

export default async function SectionsPage({ params }: PageProps<"/[locale]/admin/sections">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole(locale, ["owner"]);
  const t = await getTranslations("Admin.sections");
  const sections = await adminSections(user.id);
  const withTopics = await Promise.all(sections.map(async (s) => ({ ...s, topics: await adminTopics(user.id, s.id) })));
  const kinds = ["main", "kyrgyz", "russian", "subject"] as const;
  const sectionForm = (s?: (typeof withTopics)[number]) => (
    <form action={saveSectionAction} className="flex flex-col gap-3">
      {s && <input type="hidden" name="id" value={s.id} />}
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs font-bold">{t("slug")}<input name="slug" defaultValue={s?.slug} required className={inputCls} /></label>
        <label className="flex flex-col gap-1 text-xs font-bold">{t("kind")}
          <select name="kind" defaultValue={s?.kind ?? "subject"} className={inputCls}>{kinds.map((k) => <option key={k} value={k}>{t(`kinds.${k}`)}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-xs font-bold">{t("position")}<input name="position" type="number" defaultValue={s?.position ?? 0} className={inputCls} /></label>
        <label className="flex items-center gap-2 pt-5 text-sm font-bold"><input type="checkbox" name="isPublished" defaultChecked={s?.isPublished} />{t("published")}</label>
      </div>
      <LocFields name="title" label={t("name")} value={s?.title} />
      <button className={btnCls + " self-start"}>{t("save")}</button>
    </form>
  );
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      <p className="text-sm text-zinc-600">{t("hint")}</p>
      {withTopics.map((s) => (
        <section key={s.id} className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-card">
          <h2 className="text-lg font-extrabold">{loc(s.title, locale)} <span className="text-sm font-normal text-zinc-500">({s.slug})</span></h2>
          {sectionForm(s)}
          <div className="flex flex-col gap-3 border-t border-zinc-200 pt-4">
            <h3 className="font-bold">{t("topics")}</h3>
            {s.topics.map((x) => (
              <form key={x.id} action={saveTopicAction} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={x.id} /><input type="hidden" name="sectionId" value={s.id} />
                <input name="title_ru" defaultValue={x.title.ru ?? ""} placeholder="RU" required className={inputCls + " !w-48"} />
                <input name="title_ky" defaultValue={x.title.ky ?? ""} placeholder="KY" className={inputCls + " !w-48"} />
                <input name="position" type="number" defaultValue={x.position} className={inputCls + " !w-20"} />
                <button className={btnGhostCls}>{t("save")}</button>
              </form>
            ))}
            <form action={saveTopicAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="sectionId" value={s.id} />
              <input name="title_ru" placeholder={`RU — ${t("newTopic")}`} required className={inputCls + " !w-48"} />
              <input name="title_ky" placeholder="KY" className={inputCls + " !w-48"} />
              <input name="position" type="number" defaultValue={s.topics.length + 1} className={inputCls + " !w-20"} />
              <button className={btnGhostCls}>{t("add")}</button>
            </form>
          </div>
        </section>
      ))}
      <section className="flex flex-col gap-3 rounded-3xl border-2 border-dashed border-zinc-300 p-5">
        <h2 className="text-lg font-extrabold">{t("newSection")}</h2>
        {sectionForm()}
      </section>
    </div>
  );
}
