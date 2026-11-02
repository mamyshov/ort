import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./language-switcher";
import { Brand } from "./logo";

/** Общая шапка публичных страниц: меню по разделам, вход и регистрация. На телефоне меню раскрывается. */
export async function SiteHeader({ maxWidth = "max-w-6xl" }: { maxWidth?: string }) {
  const common = await getTranslations("Common");
  const t = await getTranslations("Nav");
  const links = [
    { href: "/#goals", label: t("goals") },
    { href: "/#how", label: t("how") },
    { href: "/#prices", label: t("prices") },
    { href: "/#faq", label: t("faq") },
  ] as const;
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-cream/90 backdrop-blur">
      <div className={`mx-auto flex w-full items-center justify-between gap-3 px-4 py-3 sm:px-6 ${maxWidth}`}>
        <Link href="/" aria-label={common("appName")}><Brand name={common("appName")} /></Link>
        <nav aria-label={t("menu")} className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold text-zinc-700 hover:bg-sun-soft">{l.label}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <div className="hidden sm:block"><LanguageSwitcher /></div>
          <Link href="/login" className="hidden rounded-xl px-3 py-2 text-sm font-bold text-zinc-700 hover:bg-sun-soft sm:block">{t("login")}</Link>
          <Link href="/register" className="rounded-full bg-sun px-5 py-2.5 text-sm font-extrabold text-ink shadow-[0_3px_0_0_#d9a800] active:translate-y-[2px] active:shadow-none">{t("signup")}</Link>
          <details className="group relative lg:hidden">
            <summary aria-label={t("menu")} className="flex size-10 cursor-pointer list-none items-center justify-center rounded-xl border-2 border-zinc-200 bg-white [&::-webkit-details-marker]:hidden">
              <span aria-hidden="true" className="text-xl leading-none group-open:hidden">☰</span>
              <span aria-hidden="true" className="hidden text-xl leading-none group-open:block">✕</span>
            </summary>
            <div className="absolute right-0 top-12 flex w-64 flex-col gap-1 rounded-2xl border border-zinc-200 bg-white p-3 shadow-card">
              {links.map((l) => (
                <Link key={l.href} href={l.href} className="rounded-xl px-3 py-2.5 font-bold hover:bg-sun-soft">{l.label}</Link>
              ))}
              <Link href="/login" className="rounded-xl px-3 py-2.5 font-bold hover:bg-sun-soft">{t("login")}</Link>
              <div className="border-t border-zinc-200 px-1 pt-3"><LanguageSwitcher /></div>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
