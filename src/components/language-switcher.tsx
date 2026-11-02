"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { NATIVE_NAMES, type UiLocale } from "@/i18n/locales";

export function LanguageSwitcher() {
  const t = useTranslations("Language");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <label className="flex items-center gap-2 text-sm text-zinc-600">
      <span className="sr-only">{t("label")}</span>
      <select
        value={locale}
        onChange={(e) =>
          router.replace(pathname, {
            locale: e.target.value as (typeof routing.locales)[number],
          })
        }
        className="rounded-lg border-2 border-zinc-200 bg-white px-2 py-1 font-bold"
      >
        {routing.locales.map((l) => (
          <option key={l} value={l}>
            {NATIVE_NAMES[l as UiLocale]}
          </option>
        ))}
      </select>
    </label>
  );
}
