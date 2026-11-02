import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { btnGhostCls, inputCls } from "@/components/loc-fields";
import { adminSections, listQuestions } from "@/lib/admin";
import { loc } from "@/lib/content";
import { requireRole } from "@/lib/guards";
import { deleteQuestionAction, publishAction } from "../actions";

export default async function QuestionsPage({ params, searchParams }: PageProps<"/[locale]/admin/questions">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole(locale, ["owner"]);
  const t = await getTranslations("Admin.questions");
  const sp = await searchParams;
  const f = { sectionId: typeof sp.section === "string" && /^[0-9a-f-]{36}$/.test(sp.section) ? sp.section : undefined,
    status: typeof sp.status === "string" ? sp.status : "", q: typeof sp.q === "string" ? sp.q.slice(0, 100) : "" };
  const [sections, rows] = await Promise.all([adminSections(user.id), listQuestions(user.id, f)]);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{t("title")}</h1>
        <Link href="/admin/questions/new" className="rounded-xl btn-primary px-4 py-2 text-sm font-bold text-white">{t("add")}</Link>
      </div>
      <form className="flex flex-wrap gap-2" method="get">
        <select name="section" defaultValue={f.sectionId ?? ""} className={inputCls + " !w-auto"}>
          <option value="">{t("allSections")}</option>
          {sections.map((s) => <option key={s.id} value={s.id}>{loc(s.title, locale)}</option>)}
        </select>
        <select name="status" defaultValue={f.status} className={inputCls + " !w-auto"}>
          <option value="">{t("anyStatus")}</option><option value="published">{t("published")}</option><option value="draft">{t("draft")}</option>
        </select>
        <input name="q" defaultValue={f.q} placeholder={t("search")} className={inputCls + " !w-auto"} />
        <button className={btnGhostCls}>{t("filter")}</button>
      </form>
      {sp.error && <p role="alert" className="text-sm font-bold text-red-600">{t("publishError")}</p>}
      <p className="text-sm text-zinc-500">{t("found", { n: rows.length })}</p>
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
            <Link href={`/admin/questions/${r.id}`} className="min-w-0 flex-1">
              <span className="line-clamp-2 font-bold">{loc(r.prompt, locale)}</span>
              <span className="text-xs text-zinc-500">{loc(r.sectionTitle, locale)}{r.topicTitle ? ` · ${loc(r.topicTitle, locale)}` : ""}</span>
            </Link>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${r.isPublished ? "bg-emerald-100 text-emerald-800" : "bg-sun-soft text-ink"}`}>
              {r.isPublished ? t("published") : r.hasKey ? t("draft") : t("noKey")}
            </span>
            {r.isFree && <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand-dark">{t("free")}</span>}
            <form action={publishAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="on" value={r.isPublished ? "0" : "1"} />
              <button className={btnGhostCls}>{r.isPublished ? t("unpublish") : t("publish")}</button></form>
            <form action={deleteQuestionAction}><input type="hidden" name="id" value={r.id} />
              <button className={btnGhostCls}>{t("delete")}</button></form>
          </li>
        ))}
      </ul>
    </div>
  );
}
