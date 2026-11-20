/** What every Open Graph card shares: the size and the caching. */
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;
/** What a crawler or browser keeps. */
export const OG_BROWSER_CACHE_CONTROL = "public, max-age=3600";

/** A card that could not be drawn: never cached. */
export function ogImageFailure(): Response {
  return new Response("Unable to generate Open Graph image", {
    status: 500,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
