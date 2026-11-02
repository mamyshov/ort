export type Locale = "ru" | "ky" | "en";
export type Localized = Partial<Record<Locale, string>>;

/** Текст на нужном языке; если перевода нет, берётся русский, затем любой имеющийся. */
export function loc(value: Localized | null | undefined, locale: string): string {
  if (!value) return "";
  const own = value[locale as Locale];
  if (own) return own;
  // новые языки интерфейса без своих материалов: узбекский и казахский читают по-русски, остальные по-английски
  const english = ["es", "pt", "tr"].includes(locale);
  return (english ? value.en || value.ru : value.ru) || Object.values(value).find(Boolean) || "";
}
