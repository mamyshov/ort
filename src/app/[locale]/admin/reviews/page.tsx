import { getTranslations, setRequestLocale } from "next-intl/server";
import { btnCls, inputCls } from "@/components/loc-fields";
import { loc } from "@/lib/content";
import { pendingReviews } from "@/lib/exams";
import { requireRole } from "@/lib/guards";
import { reviewAction } from "../actions";
import { gradingDraftAction } from "../ai-actions";

export default async function ReviewsPage({ params, searchParams }: PageProps<"/[locale]/admin/reviews">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole(locale, ["owner", "teacher"]);
  const t = await getTranslations("Admin");
  const rows = await pendingReviews(user.id);
  const failed = (await searchParams).error;
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <h1 className="text-2xl font-extrabold">{t("reviews.title")}</h1>
      {failed && <p role="alert" className="text-sm text-red-600">{t("common.error")}</p>}
      {rows.length === 0 && <p className="text-zinc-600">{t("reviews.empty")}</p>}
      {rows.map((r) => (
        <form key={r.id} action={reviewAction} className="flex flex-col gap-3 rounded-3xl border border-zinc-200 bg-white shadow-card p-5">
          <input type="hidden" name="id" value={r.id} />
          <div className="text-sm text-zinc-500">
            {r.student} · {loc(r.courseTitle, locale)} · {loc(r.lessonTitle, locale)}
          </div>
          {r.prompt && <p className="text-sm italic text-zinc-600">{loc(r.prompt, locale)}</p>}
          <p className="whitespace-pre-line rounded-lg bg-zinc-50 p-3">{r.text}</p>
          {r.aiDraft && (
            <p className="rounded-lg bg-sky-50 p-3 text-sm text-sky-900">
              <span className="font-medium">{t("reviews.aiDraft")}: </span>
              {r.aiDraft.score != null && <>{r.aiDraft.score}% — </>}{r.aiDraft.comment}
            </p>
          )}
          {!r.aiDraft && (
            <button type="submit" formAction={gradingDraftAction} formNoValidate className="self-start rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium">
              {t("ai.draft")}
            </button>
          )}
          <label className="flex flex-col gap-1 text-sm">
            {t("reviews.score")} <span className="text-xs text-zinc-500">{t("reviews.passHint")}</span>
            <input name="score" type="number" min={0} max={100} required className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {t("reviews.feedback")}
            <textarea name="feedback" rows={3} className={inputCls} />
          </label>
          <button type="submit" className={`${btnCls} self-start`}>{t("reviews.submit")}</button>
        </form>
      ))}
    </div>
  );
}
