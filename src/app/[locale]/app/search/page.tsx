import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { loc } from "@/lib/content";
import { searchLessons } from "@/lib/cabinet";
import { requireUser } from "@/lib/guards";

export default async function SearchPage({
  params,
  searchParams,
}: PageProps<"/[locale]/app/search">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations("App.search");
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim() ?? "";
  const tooShort = q.length > 0 && q.length < 2;
  const hits = q.length >= 2 ? await searchLessons(user.id, q.slice(0, 100), locale) : null;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      <form className="flex gap-2" role="search">
        <input
          name="q"
          defaultValue={q}
          placeholder={t("placeholder")}
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-base"
        />
        <button type="submit" className="rounded-xl btn-primary px-4 py-2 text-sm font-medium text-white">
          {t("submit")}
        </button>
      </form>
      {tooShort && <p className="text-sm text-zinc-600">{t("minChars")}</p>}
      {hits && (
        <>
          <p className="text-sm text-zinc-600">
            {hits.length === 0 ? t("empty") : t("results", { count: hits.length })}
          </p>
          <ul className="flex flex-col gap-2">
            {hits.map((h) => (
              <li key={h.id}>
                <Link
                  href={`/app/lessons/${h.id}`}
                  className="block rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50"
                >
                  <span className="font-medium">{loc(h.title, locale)}</span>
                  <span className="block text-sm text-zinc-500">
                    {loc(h.courseTitle, locale)} · {loc(h.moduleTitle, locale)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
