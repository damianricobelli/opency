import { getUrlOrigin } from "@/paraglide/runtime";

/**
 * The site's public origin, from `VITE_SITE_URL` when the deployment names
 * one. It is read at build time so the server and the browser agree on
 * every absolute URL in the head.
 */
const CONFIGURED_ORIGIN = import.meta.env.VITE_SITE_URL
  ? new URL(import.meta.env.VITE_SITE_URL).origin
  : null;

/** What Paraglide answers outside a request and outside a browser. */
const PARAGLIDE_FALLBACK_ORIGIN = "http://fallback.com";
/** Only reached by code that runs with no request at all (a script, a test). */
const LOCAL_ORIGIN = "http://localhost:3000";

/**
 * Where canonical, hreflang, Open Graph and sitemap URLs point: the
 * configured origin, or else the origin this request arrived on (so a
 * preview deploy describes itself). No domain is assumed.
 */
export function currentSiteOrigin(): string {
  if (CONFIGURED_ORIGIN) return CONFIGURED_ORIGIN;
  const origin = getUrlOrigin();
  return origin === PARAGLIDE_FALLBACK_ORIGIN ? LOCAL_ORIGIN : origin;
}
