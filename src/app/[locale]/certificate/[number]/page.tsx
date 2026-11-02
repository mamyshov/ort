import { getTranslations, setRequestLocale } from "next-intl/server";
import { PrintButton } from "@/components/print-button";
import { loc } from "@/lib/content";
import { verifyCertificate } from "@/lib/exams";

export default async function CertificatePage({ params }: PageProps<"/[locale]/certificate/[number]">) {
  const { locale, number } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Certificate");
  const cert = await verifyCertificate(number.toUpperCase());
  if (!cert) {
    return <main className="mx-auto max-w-xl p-8 text-center text-zinc-700">{t("notFound")}</main>;
  }
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(cert.issuedAt);
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center gap-6 p-4 sm:p-8">
      <section className="w-full rounded-2xl border-4 border-double border-zinc-800 bg-white p-6 text-center sm:p-10">
        <p className="text-sm uppercase tracking-widest text-zinc-500">{t("issuer")}</p>
        <h1 className="mt-4 text-2xl font-extrabold sm:text-3xl">{t("heading")}</h1>
        <p className="mt-8 text-sm text-zinc-500">{t("awarded")}</p>
        <p className="mt-1 text-3xl font-extrabold">{cert.name}</p>
        <p className="mt-6 text-sm text-zinc-500">{t("course")}</p>
        <p className="mt-1 text-xl">{loc(cert.courseTitle, locale)}</p>
        <dl className="mt-8 flex flex-wrap justify-center gap-x-10 gap-y-2 text-sm">
          <div><dt className="text-zinc-500">{t("date")}</dt><dd>{date}</dd></div>
          <div><dt className="text-zinc-500">{t("number")}</dt><dd className="font-mono">{cert.number}</dd></div>
        </dl>
      </section>
      <p className="text-sm font-medium text-emerald-700">✓ {t("valid")}</p>
      <PrintButton label={t("print")} />
    </main>
  );
}
