import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import { FALLBACK_LOCALE, type UiLocale } from "./locales";

type Messages = { [k: string]: string | Messages | unknown[] };

const isObj = (v: unknown): v is Messages => !!v && typeof v === "object" && !Array.isArray(v);

/** Накладывает перевод на запасной язык: чего нет в переводе, берётся из запасного. */
function merge(base: Messages, over: Messages): Messages {
  const out: Messages = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = isObj(v) && isObj(base[k]) ? merge(base[k] as Messages, v) : v;
  return out;
}

async function load(locale: UiLocale): Promise<Messages> {
  const own = (await import(`../../messages/${locale}.json`)).default as Messages;
  const fb = FALLBACK_LOCALE[locale];
  return fb ? merge(await load(fb), own) : own;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return { locale, messages: await load(locale) };
});
