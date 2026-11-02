import { defineRouting } from "next-intl/routing";
import { UI_LOCALES } from "./locales";

export const routing = defineRouting({
  locales: [...UI_LOCALES],
  defaultLocale: "ru",
});

export type Locale = (typeof routing.locales)[number];
