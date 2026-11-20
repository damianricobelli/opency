import { createFileRoute } from "@tanstack/react-router";
import { baseLocale, locales } from "@/i18n";
import { PUBLIC_SEO_ROUTES, publicPageUrl } from "@/lib/seo";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/** One `<url>` per language of each page, every one listing all its alternates. */
function sitemapXml(): string {
  const lastmod = import.meta.env.BUILD_DATE
    ? `<lastmod>${import.meta.env.BUILD_DATE}</lastmod>`
    : "";
  const entries = PUBLIC_SEO_ROUTES.flatMap(({ path }) => {
    const alternates = locales
      .map(
        (locale) =>
          `<xhtml:link rel="alternate" hreflang="${locale}" href="${escapeXml(
            publicPageUrl(path, locale),
          )}" />`,
      )
      .join("");
    const defaultAlternate = `<xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(
      publicPageUrl(path, baseLocale),
    )}" />`;
    return locales.map(
      (locale) =>
        `<url><loc>${escapeXml(publicPageUrl(path, locale))}</loc>${lastmod}${alternates}${defaultAlternate}</url>`,
    );
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${entries}</urlset>`;
}

/** The pages change with a deploy: an hour in the crawler is enough. */
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () =>
        new Response(sitemapXml(), {
          headers: {
            "Cache-Control": "public, max-age=3600",
            "Content-Type": "application/xml; charset=utf-8",
          },
        }),
    },
  },
});
