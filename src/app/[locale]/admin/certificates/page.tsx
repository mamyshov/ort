import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { btnCls } from "@/components/loc-fields";
import { loc } from "@/lib/content";
import { certificateCandidates, issuedCertificates } from "@/lib/exams";
import { requireRole } from "@/lib/guards";
import { issueCertificateAction } from "../actions";

export default async function CertificatesPage({ params, searchParams }: PageProps<"/[locale]/admin/certificates">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole(locale, ["owner", "teacher"]);
  const t = await getTranslations("Admin");
  const [ready, issued] = await Promise.all([certificateCandidates(user.id), issuedCertificates(user.id)]);
  const failed = (await searchParams).error;
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "short" });
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-extrabold">{t("certs.title")}</h1>
      {failed && <p role="alert" className="text-sm text-red-600">{t("common.error")}</p>}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-extrabold">{t("certs.ready")}</h2>
        {ready.length === 0 && <p className="text-sm text-zinc-500">{t("certs.none")}</p>}
        {ready.map((c) => (
          <form key={c.userId + c.courseId} action={issueCertificateAction}
            className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4">
            <input type="hidden" name="userId" value={c.userId} />
            <input type="hidden" name="courseId" value={c.courseId} />
            <span>{c.student} · <span className="text-zinc-500">{loc(c.courseTitle, locale)}</span></span>
            <button type="submit" className={btnCls}>{t("certs.issue")}</button>
          </form>
        ))}
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-extrabold">{t("certs.issued")}</h2>
        {issued.map((c) => (
          <Link key={c.number} href={`/certificate/${c.number}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50">
            <span>{c.student} · <span className="text-zinc-500">{loc(c.courseTitle, locale)}</span></span>
            <span className="font-mono text-xs text-zinc-500">{c.number} · {fmt.format(c.issuedAt)}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
