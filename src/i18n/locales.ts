/** Языки интерфейса и вопросов ORT Prep. */
export const UI_LOCALES = ["ru", "ky"] as const;
export type UiLocale = (typeof UI_LOCALES)[number];

/** Название языка на нём самом: так человек находит свой язык в списке. */
export const NATIVE_NAMES: Record<UiLocale, string> = { ru: "Русский", ky: "Кыргызча" };

/** Если для языка нет перевода строки, берём этот язык. */
export const FALLBACK_LOCALE: Record<UiLocale, UiLocale | null> = { ru: null, ky: "ru" };

export const isUiLocale = (v: unknown): v is UiLocale => typeof v === "string" && (UI_LOCALES as readonly string[]).includes(v);
