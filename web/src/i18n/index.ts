import { baseLocale, locales } from "@/paraglide/runtime";

/**
 * The site's locales, as `project.inlang/settings.json` lists them. `en` is
 * the original copy and the unprefixed URLs; `es` is Rioplatense Spanish
 * ("vos") under `/es`.
 */
export { baseLocale, locales };

export type AppLocale = (typeof locales)[number];

export function isLocale(value: string): value is AppLocale {
  return locales.some((locale) => locale === value);
}
