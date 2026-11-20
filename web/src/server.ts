import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { paraglideMiddleware } from "@/paraglide/server.js";

/** Two years, as browsers' preload lists ask; only ever sent over HTTPS. */
const HSTS = "max-age=63072000; includeSubDomains";

function withSecurityHeaders(request: Request, response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  if (new URL(request.url).protocol === "https:") {
    headers.set("Strict-Transport-Security", HSTS);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Paraglide resolves the request's locale (URL, then cookie, then English)
// before the router renders, so `getLocale()` is right during SSR.
export default createServerEntry({
  async fetch(request) {
    const response = await paraglideMiddleware(request, () =>
      handler.fetch(request),
    );
    return withSecurityHeaders(request, response);
  },
});
