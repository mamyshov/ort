import { getTranslations, setRequestLocale } from "next-intl/server";
import { Brand } from "@/components/logo";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";
import { requireRole } from "@/lib/guards";
import { logoutAction } from "../login/actions";

export default async function AdminLayout({ children, params }: LayoutProps<"/[locale]/admin">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole(locale, ["owner", "manager", "teacher"]);
  const t = await getTranslations("Admin.nav");
  const common = await getTranslations("Common");
  const link = "shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-brand-soft hover:text-brand-dark";

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2">
          <Link href="/admin" className="mr-3"><Brand name={common("appName")} /></Link>
          <nav aria-label={t("menu")} className="order-3 flex w-full flex-wrap items-center gap-1">
            <Link href="/admin" className={link}>{t("dashboard")}</Link>
            <Link href="/admin/courses" className={link}>{t("courses")}</Link>
            <Link href="/admin/progress" className={link}>{t("progress")}</Link>
            {user.role !== "teacher" && <Link href="/admin/students" className={link}>{t("students")}</Link>}
            {user.role !== "teacher" && <Link href="/admin/payments" className={link}>{t("payments")}</Link>}
            {user.role !== "teacher" && <Link href="/admin/leads" className={link}>{t("leads")}</Link>}
            {user.role === "owner" && <Link href="/admin/audit" className={link}>{t("audit")}</Link>}
            {user.role !== "manager" && <Link href="/admin/reviews" className={link}>{t("reviews")}</Link>}
            {user.role !== "manager" && <Link href="/admin/certificates" className={link}>{t("certificates")}</Link>}
            <Link href="/app" className={link}>{t("cabinet")}</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <LanguageSwitcher />
            <form action={logoutAction}><button type="submit" className={link}>{t("logout")}</button></form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
