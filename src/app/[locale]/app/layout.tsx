import { getTranslations, setRequestLocale } from "next-intl/server";
import { Brand } from "@/components/logo";
import { BottomNav } from "@/components/bottom-nav";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";
import { isStaff } from "@/lib/auth";
import { requireUser } from "@/lib/guards";
import { logoutAction } from "../login/actions";
import { ReturnToParentForm } from "./children/child-forms";

export default async function CabinetLayout({ children, params }: LayoutProps<"/[locale]/app">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations("App.nav");
  const common = await getTranslations("Common");
  const tc = await getTranslations("Children");
  const isChild = Boolean(user.guardianId);

  const navLink = "shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-brand-soft hover:text-brand-dark";

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      {isChild && (
        <div className="relative bg-coral px-4 py-2 text-ink">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
            <span className="font-extrabold">🧒 {tc("modeBanner", { name: user.fullName ?? "" })}</span>
            <ReturnToParentForm />
          </div>
        </div>
      )}
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2">
          <Link href="/app" className="mr-3"><Brand name={common("appName")} /></Link>
          <nav className="hidden items-center gap-1 md:flex md:flex-wrap" aria-label={t("menu")}>
            <Link href="/app" className={navLink}>{t("courses")}</Link>
            <Link href="/app/practice" className={navLink}>{t("practice")}</Link>
            <Link href="/app/search" className={navLink}>{t("search")}</Link>
            {!isChild && <Link href="/app/children" className={navLink}>{t("children")}</Link>}
            <Link href="/app/profile" className={navLink}>{t("profile")}</Link>
            {isStaff(user.role) && (
              <Link href="/admin" className={navLink}>{t("admin")}</Link>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <LanguageSwitcher />
            <form action={logoutAction}>
              <button type="submit" className={navLink}>{t("logout")}</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 md:pb-10">{children}</main>
      <BottomNav
        label={t("menu")}
        items={[
          { key: "courses", href: "/app", label: t("courses") },
          { key: "practice", href: "/app/practice", label: t("practice") },
          { key: "search", href: "/app/search", label: t("search") },
          ...(!isChild ? [{ key: "children" as const, href: "/app/children", label: t("children") }] : []),
          { key: "profile", href: "/app/profile", label: t("profile") },
          ...(isStaff(user.role) ? [{ key: "admin" as const, href: "/admin", label: t("admin") }] : []),
        ]}
      />
    </div>
  );
}
