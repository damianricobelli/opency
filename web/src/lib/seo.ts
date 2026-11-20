import type { AppLocale } from "@/i18n";
import { baseLocale, locales } from "@/i18n";
import { OG_HEIGHT, OG_WIDTH } from "@/lib/og-image";
import { SITE_NAME } from "@/lib/site";
import { currentSiteOrigin } from "@/lib/site-origin";
import { localizeUrl } from "@/paraglide/runtime";

/** Every indexable page, and the Open Graph card drawn for it. */
export const PUBLIC_SEO_ROUTES = [{ path: "/", variant: "landing" }] as const;

type PublicSeoPath = (typeof PUBLIC_SEO_ROUTES)[number]["path"];
export type OgImageVariant = (typeof PUBLIC_SEO_ROUTES)[number]["variant"];

export function publicPageUrl(path: PublicSeoPath, locale: AppLocale): string {
  return localizeUrl(new URL(path, currentSiteOrigin()), { locale }).toString();
}

export function ogImageUrl(variant: OgImageVariant, locale: AppLocale): string {
  const url = new URL("/api/og-image", currentSiteOrigin());
  url.searchParams.set("variant", variant);
  return localizeUrl(url, { locale }).toString();
}

/** Open Graph's language_TERRITORY for a page locale. */
const OPEN_GRAPH_LOCALES: Partial<Record<string, string>> = {
  en: "en_US",
  // The Spanish page is Rioplatense, as it was written.
  es: "es_AR",
};

/** "es" → "es_AR", "pt-BR" → "pt_BR": the page's language as Open Graph reads it. */
export function openGraphLocale(locale: string): string {
  const known = OPEN_GRAPH_LOCALES[locale];
  if (known) return known;
  const [language = locale, region] = locale.split("-");
  return region ? `${language}_${region.toUpperCase()}` : language;
}

export function buildPublicSeoHead({
  path,
  variant,
  locale,
  title,
  description,
  imageAlt = title,
  type = "website",
}: {
  path: PublicSeoPath;
  variant: OgImageVariant;
  locale: AppLocale;
  title: string;
  description: string;
  imageAlt?: string;
  type?: "website" | "article";
}) {
  const canonical = publicPageUrl(path, locale);
  const image = ogImageUrl(variant, locale);
  const alternateLocales = locales.filter((candidate) => candidate !== locale);

  return {
    meta: [
      { title },
      { name: "description", content: description },
      {
        name: "robots",
        content: "index, follow, max-image-preview:large, max-snippet:-1",
      },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: type },
      { property: "og:url", content: canonical },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:locale", content: openGraphLocale(locale) },
      ...alternateLocales.map((alternate) => ({
        property: "og:locale:alternate",
        content: openGraphLocale(alternate),
      })),
      { property: "og:image", content: image },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:width", content: String(OG_WIDTH) },
      { property: "og:image:height", content: String(OG_HEIGHT) },
      { property: "og:image:alt", content: imageAlt },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: image },
      { name: "twitter:image:alt", content: imageAlt },
      { name: "twitter:url", content: canonical },
    ],
    links: [
      { rel: "canonical", href: canonical },
      ...locales.map((alternate) => ({
        rel: "alternate",
        hrefLang: alternate,
        href: publicPageUrl(path, alternate),
      })),
      {
        rel: "alternate",
        hrefLang: "x-default",
        href: publicPageUrl(path, baseLocale),
      },
    ],
  };
}
