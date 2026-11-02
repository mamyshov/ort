export type Locale = "ru" | "ky";
export type Localized = Partial<Record<Locale, string>>;

/** Текст на нужном языке; если перевода нет, берётся русский, затем любой имеющийся. */
export function loc(value: Localized | null | undefined, locale: string): string {
  if (!value) return "";
  return value[locale as Locale] || value.ru || Object.values(value).find(Boolean) || "";
}
