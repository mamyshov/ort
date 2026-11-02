import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { btnCls, inputCls } from "@/components/loc-fields";
import { listStudents } from "@/lib/admin";
import { requireRole } from "@/lib/guards";

export default async function StudentsPage({ params, searchParams }: PageProps<"/[locale]/admin/students">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole(locale, ["owner", "manager"]);
  const t = await getTranslations("Admin.students");
  const sp = await searchParams;
  const q = ((Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "").trim().slice(0, 100);
  const rows = await listStudents(user.id, q);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      <form role="search" className="flex gap-2">
        <input name="q" defaultValue={q} placeholder={t("search")} className={inputCls} />
        <button type="submit" className={btnCls}>{t("find")}</button>
      </form>
      <ul className="flex flex-col gap-2">
        {rows.map((s) => (
          <li key={s.id}>
            <Link href={`/admin/students/${s.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50">
              <span>
                <span className="block font-medium">{s.name || s.email}</span>
                {s.name && <span className="block text-sm text-zinc-500">{s.email}</span>}
              </span>
              <span className="text-sm text-zinc-600">{t("courses")}: {s.courses}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
