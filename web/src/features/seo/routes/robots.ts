import { createFileRoute } from "@tanstack/react-router";
import { currentSiteOrigin } from "@/lib/site-origin";

/**
 * Served by a route, not a static file: the sitemap line needs the site's
 * own absolute URL, which only the deployment knows.
 */
export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(
          `# https://www.robotstxt.org/robotstxt.html\nUser-agent: *\nDisallow:\n\nSitemap: ${currentSiteOrigin()}/sitemap.xml\n`,
          {
            headers: {
              "Cache-Control": "public, max-age=3600",
              "Content-Type": "text/plain; charset=utf-8",
            },
          },
        ),
    },
  },
});
