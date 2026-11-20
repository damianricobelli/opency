import instrumentSerifLatin from "@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2?url";
import geistLatin from "@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url";
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { getLocale } from "@/paraglide/runtime";
import appCss from "../styles.css?url";

/** The page background per scheme (`--background` in `styles.css`). */
const THEME_COLORS = { light: "#faf9f7", dark: "#0f0e0d" } as const;

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
      // The page follows the system's scheme, so one tag per scheme.
      {
        name: "theme-color",
        media: "(prefers-color-scheme: light)",
        content: THEME_COLORS.light,
      },
      {
        name: "theme-color",
        media: "(prefers-color-scheme: dark)",
        content: THEME_COLORS.dark,
      },
      { name: "color-scheme", content: "light dark" },
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
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang={getLocale()}>
      <head>
        <HeadContent />
      </head>
      <body className="antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}
