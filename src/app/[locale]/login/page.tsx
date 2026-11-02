import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { GoogleButton } from "@/components/google-button";
import { LoginForm } from "./login-form";

export default async function LoginPage({ params, searchParams }: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  const err = (await searchParams).error;
  const ta = await getTranslations("Auth");
  setRequestLocale(locale);
  const t = await getTranslations("Login");

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
        <h1 className="text-4xl font-bold">{t("title")}</h1>
        <div className="flex flex-col gap-5 rounded-3xl border border-zinc-200 bg-white p-6 shadow-card">
          {err === "google" && <p role="alert" className="text-sm font-bold text-red-600">{ta("googleError")}</p>}
          {err === "staff" && <p role="alert" className="text-sm font-bold text-red-600">{ta("staff")}</p>}
          <GoogleButton locale={locale} />
          <LoginForm />
        </div>
        <p className="text-center text-sm text-zinc-600">{t("noAccount")} <Link href="/register" className="font-extrabold text-brand underline">{t("signup")}</Link></p>
      </main>
      <SiteFooter />
    </div>
  );
}
