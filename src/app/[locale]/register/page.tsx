import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { GoogleButton } from "@/components/google-button";
import { RegisterForm } from "./register-form";

export default async function RegisterPage({ params, searchParams }: PageProps<"/[locale]/register">) {
  const { locale } = await params;
  const child = (await searchParams).child === "1";
  setRequestLocale(locale);
  if (await getCurrentUser()) return redirect({ href: "/app", locale });
  const t = await getTranslations("Register");
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold">{child ? t("childTitle") : t("title")}</h1>
          <p className="text-zinc-600">{child ? t("childSubtitle") : t("subtitle")}</p>
        </div>
        <div className="flex flex-col gap-5 rounded-3xl border border-zinc-200 bg-white p-6 shadow-card">{!child && <GoogleButton locale={locale} />}<RegisterForm child={child} /></div>
        <Link href={child ? "/register" : "/register?child=1"} className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-300 bg-zinc-100 p-5 hover:border-brand">
          <span className="flex flex-col"><b className="text-lg">{child ? t("forMe") : t("forChild")}</b><span className="text-sm text-zinc-600">{child ? t("forMeText") : t("forChildText")}</span></span>
          <span aria-hidden="true" className="text-2xl">→</span>
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
