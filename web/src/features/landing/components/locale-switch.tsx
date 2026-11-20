import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { getLocale, locales, localizeHref } from "@/paraglide/runtime";

/**
 * Plain links, one per locale: the URL carries the language (`/` English,
 * `/es` Spanish), so a full navigation is the switch and crawlers can
 * follow it. `reloadDocument`-style anchors keep Paraglide's cookie in sync
 * through the server middleware.
 */
export function LocaleSwitch({ className }: { className?: string }) {
  const current = getLocale();
  return (
    <nav
      aria-label={m.nav_language()}
      className={cn(
        "flex items-center rounded-full border p-0.5 font-mono text-xs",
        className,
      )}
    >
      {locales.map((locale) => (
        <a
          key={locale}
          href={localizeHref("/", { locale })}
          hrefLang={locale}
          lang={locale}
          aria-current={locale === current ? "true" : undefined}
          className="relative grid h-8 min-w-9 place-items-center rounded-full px-2.5 text-muted-foreground uppercase pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-1.5 outline-none transition-[background-color,color] duration-150 ease-out hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-[current]:bg-foreground aria-[current]:text-background"
        >
          {locale}
        </a>
      ))}
    </nav>
  );
}
