import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { requireUser } from "@/lib/guards";
import { listChildren, MAX_CHILDREN } from "@/lib/children";
import { AddChildForm } from "./child-forms";
import { openChildAction } from "./actions";

export default async function ChildrenPage({ params, searchParams }: PageProps<"/[locale]/app/children">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  if (user.guardianId) return redirect({ href: "/app", locale });
  const t = await getTranslations("Children");
  const kids = await listChildren(user.id);
  const welcome = (await searchParams).new;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold sm:text-4xl">{t("title")}</h1>
        <p className="max-w-2xl text-zinc-600">{t("intro")}</p>
      </div>
      {welcome && kids.length > 0 && <p role="status" className="rounded-2xl bg-sun-soft p-4 font-bold">{t("welcome")}</p>}
      {kids.length === 0 && <p className="text-zinc-600">{t("empty")}</p>}
      <ul className="grid gap-4 md:grid-cols-2">
        {kids.map((c) => (
          <li key={c.id} className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-card">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-2xl bg-sky text-3xl">{c.ageGroup === "kids" ? "🧒" : "🧑"}</span>
              <div>
                <h2 className="text-xl font-extrabold">{c.fullName}</h2>
                <p className="text-sm text-zinc-500">{t(`ageGroup.${c.ageGroup}`)}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <form action={openChildAction}>
                <input type="hidden" name="childId" value={c.id} />
                <button type="submit" className="btn-primary px-5 py-2.5">{t("open")}</button>
              </form>
              <Link href={`/offer?child=${c.id}`} className="rounded-xl border-2 border-zinc-300 px-5 py-2.5 font-extrabold hover:border-brand">{t("buy")}</Link>
            </div>
          </li>
        ))}
      </ul>
      {kids.length < MAX_CHILDREN && <div className="max-w-md"><AddChildForm /></div>}
      <p className="max-w-2xl text-sm text-zinc-500">{t("privacy")}</p>
    </div>
  );
}
