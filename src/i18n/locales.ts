/** Языки интерфейса сайта. Тексты для обучающих материалов хранятся отдельно (ru, ky, en), см. src/lib/content.ts. */
export const UI_LOCALES = ["ru", "ky", "en", "uz", "kk", "es", "pt", "tr"] as const;
export type UiLocale = (typeof UI_LOCALES)[number];

/** Название языка на нём самом: так человек находит свой язык в списке. */
export const NATIVE_NAMES: Record<UiLocale, string> = {
  ru: "Русский", ky: "Кыргызча", en: "English", uz: "Oʻzbekcha", kk: "Қазақша", es: "Español", pt: "Português", tr: "Türkçe",
};

/** Если для языка нет перевода строки, берём этот язык: узбекский и казахский читают по-русски, остальные по-английски. */
export const FALLBACK_LOCALE: Record<UiLocale, UiLocale | null> = {
  ru: null, ky: null, en: null, uz: "ru", kk: "ru", es: "en", pt: "en", tr: "en",
};

export const isUiLocale = (v: unknown): v is UiLocale => typeof v === "string" && (UI_LOCALES as readonly string[]).includes(v);
