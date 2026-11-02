import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { btnCls, inputCls, LocFields } from "@/components/loc-fields";
import { adminSections, adminTopics, getQuestion } from "@/lib/admin";
import { loc } from "@/lib/content";
import { requireRole } from "@/lib/guards";
import { saveQuestionAction } from "../../actions";

export default async function QuestionEditPage({ params, searchParams }: PageProps<"/[locale]/admin/questions/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireRole(locale, ["owner"]);
  const t = await getTranslations("Admin.questions");
  const sp = await searchParams;
  const q = id === "new" ? null : await getQuestion(user.id, id);
  if (id !== "new" && !q) notFound();
  const sections = await adminSections(user.id);
  const sectionId = q?.sectionId ?? (typeof sp.section === "string" ? sp.section : sections[0]?.id);
  const topics = sectionId ? await adminTopics(user.id, sectionId) : [];
  const ids = ["a", "b", "c", "d", "e", "f"];
  return (
    <form action={saveQuestionAction} className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold">{q ? t("edit") : t("add")}</h1>
      {sp.saved && <p role="status" className="text-sm font-bold text-emerald-700">{t("saved")}</p>}
      {sp.error && <p role="alert" className="text-sm font-bold text-red-600">{t(sp.error === "duplicate" ? "duplicate" : "invalid")}</p>}
      {q && <input type="hidden" name="id" value={q.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-bold">{t("section")}
          <select name="sectionId" defaultValue={sectionId} className={inputCls}>
            {sections.map((s) => <option key={s.id} value={s.id}>{loc(s.title, locale)}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-sm font-bold">{t("topic")}
          <select name="topicId" defaultValue={q?.topicId ?? ""} className={inputCls}>
            <option value="">—</option>{topics.map((x) => <option key={x.id} value={x.id}>{loc(x.title, locale)}</option>)}</select>
          <span className="text-xs font-normal text-zinc-500">{t("topicHint")}</span></label>
      </div>
      <LocFields name="passage" label={t("passage")} value={q?.passage} multiline requireRu={false} />
      <LocFields name="prompt" label={t("prompt")} value={q?.prompt} multiline requireRu={false} />
      <fieldset className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
        <legend className="px-1 text-sm font-bold">{t("options")}</legend>
        {ids.map((oid, n) => {
          const opt = q?.options.find((o) => o.id === oid);
          return (
            <div key={oid} className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <label className="flex items-center gap-2 pt-2 font-extrabold uppercase">
                <input type="radio" name="correct" value={oid} defaultChecked={q?.correct === oid} />{oid}
              </label>
              <div className="grid flex-1 gap-2 sm:grid-cols-2">
                <input name={`opt_${oid}_ru`} defaultValue={opt?.text.ru ?? ""} placeholder={`RU${n < 2 ? " *" : ""}`} className={inputCls} />
                <input name={`opt_${oid}_ky`} defaultValue={opt?.text.ky ?? ""} placeholder="KY" className={inputCls} />
              </div>
            </div>
          );
        })}
        <p className="text-xs text-zinc-500">{t("correctHint")}</p>
      </fieldset>
      <LocFields name="explanation" label={t("explanation")} value={q?.explanation} multiline requireRu={false} />
      <div className="flex flex-wrap items-center gap-5 text-sm">
        <label className="flex items-center gap-2 font-bold">{t("difficulty")}
          <select name="difficulty" defaultValue={q?.difficulty ?? 2} className={inputCls + " !w-auto"}>{[1, 2, 3].map((d) => <option key={d}>{d}</option>)}</select></label>
        <label className="flex items-center gap-2 font-bold"><input type="checkbox" name="isFree" defaultChecked={q?.isFree} />{t("free")}</label>
        <label className="flex items-center gap-2 font-bold"><input type="checkbox" name="publish" defaultChecked={q?.isPublished} />{t("publishNow")}</label>
      </div>
      <button type="submit" className={btnCls + " self-start"}>{t("save")}</button>
    </form>
  );
}
