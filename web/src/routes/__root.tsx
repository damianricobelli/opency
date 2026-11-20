import instrumentSerifLatin from "@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2?url";
import geistLatin from "@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url";
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { THEME_INIT_SCRIPT } from "@/hooks/use-theme-mode";
import { GITHUB_OWNER, SITE_NAME } from "@/lib/site";
import { getLocale } from "@/paraglide/runtime";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  beforeLoad: () => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("lang", getLocale());
    }
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        // `viewport-fit=cover` lets the page reach under the notch; the
        // header and footer pad themselves with `env(safe-area-inset-*)`.
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      // theme-color is added by THEME_INIT_SCRIPT, not here: it follows the
      // page's own theme, which can differ from the system's, so one tag is
      // kept in sync (useThemeMode) instead of a light/dark media pair.
      { name: "color-scheme", content: "light dark" },
      { name: "application-name", content: SITE_NAME },
      { name: "apple-mobile-web-app-title", content: SITE_NAME },
      { name: "author", content: GITHUB_OWNER },
      // Phones must not turn the commands' digits into call links.
      { name: "format-detection", content: "telephone=no" },
    ],
    links: [
      // Found only once the stylesheet is parsed, the fonts would arrive
      // after the first paint and reflow the headline.
      {
        rel: "preload",
        href: instrumentSerifLatin,
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      {
        rel: "preload",
        href: geistLatin,
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      {
        rel: "icon",
        type: "image/png",
        sizes: "96x96",
        href: "/favicon-96x96.png",
      },
      { rel: "shortcut icon", href: "/favicon.ico" },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/apple-touch-icon.png",
      },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang={getLocale()} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}
