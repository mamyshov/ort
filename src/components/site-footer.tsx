import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Brand } from "./logo";

export async function SiteFooter() {
  const common = await getTranslations("Common");
  const t = await getTranslations("Home.footer");
  const n = await getTranslations("Nav");
  const h = await getTranslations("Home");
  const col = "flex flex-col gap-2 text-sm";
  const head = "font-extrabold text-white";
  const a = "text-white/70 hover:text-sun";
  return (
    <footer className="bg-ink text-white">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-3">
          <span className="text-white [&_svg]:shrink-0"><Brand name={common("appName")} /></span>
          <p className="max-w-xs text-sm text-white/70">{t("tagline")}</p>
        </div>
        <nav className={col} aria-label={t("learn")}>
          <span className={head}>{t("learn")}</span>
          <Link href="/#how" className={a}>{n("how")}</Link>
          <Link href="/#goals" className={a}>{n("goals")}</Link>
          <Link href="/#prices" className={a}>{n("prices")}</Link>
          <Link href="/level-test" className={a}>{h("levelCta")}</Link>
        </nav>
        <nav className={col} aria-label={t("account")}>
          <span className={head}>{t("account")}</span>
          <Link href="/register" className={a}>{n("signup")}</Link>
          <Link href="/login" className={a}>{n("login")}</Link>
          <Link href="/forgot" className={a}>{t("forgot")}</Link>
        </nav>
        <nav className={col} aria-label={t("legal")}>
          <span className={head}>{t("legal")}</span>
          <Link href="/terms" className={a}>{t("terms")}</Link>
          <Link href="/#faq" className={a}>{n("faq")}</Link>
        </nav>
      </div>
      <div className="border-t border-white/10 px-4 py-5 text-center text-xs text-white/50">{t("rights", { year: new Date().getFullYear(), name: common("appName") })}</div>
    </footer>
  );
}
