import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { GoogleButton } from "@/components/google-button";
import { RegisterForm } from "./register-form";

export default async function RegisterPage({ params }: PageProps<"/[locale]/register">) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (await getCurrentUser()) return redirect({ href: "/app", locale });
  const t = await getTranslations("Register");
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold">{t("title")}</h1>
          <p className="text-zinc-600">{t("subtitle")}</p>
        </div>
        <div className="flex flex-col gap-5 rounded-3xl border border-zinc-200 bg-white p-6 shadow-card">
          <GoogleButton locale={locale} />
          <RegisterForm />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
