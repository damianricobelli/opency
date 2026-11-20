import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages";
import { GITHUB_URL } from "../lib/site";
import { GithubMark } from "./github-mark";
import { LocaleSwitch } from "./locale-switch";

const NAV = [
  { href: "#brief", label: m.nav_brief },
  { href: "#flow", label: m.nav_flow },
  { href: "#quality", label: m.nav_quality },
  { href: "#mcp", label: m.nav_mcp },
  { href: "#install", label: m.nav_install },
] as const;

export function Wordmark() {
  return (
    <span className="flex items-center gap-2 font-display text-2xl leading-none tracking-tight">
      <span
        aria-hidden
        className="relative block h-5 w-4 rounded-[5px] bg-foreground"
      >
        <span className="absolute right-[3px] bottom-[3px] size-1.5 rounded-full bg-brand" />
      </span>
      opentcy
    </span>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-transparent bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-md supports-[animation-timeline:scroll()]:animate-[header-border_linear_both] supports-[animation-timeline:scroll()]:[animation-range:0_80px] supports-[animation-timeline:scroll()]:[animation-timeline:scroll()]">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 pr-[max(1.25rem,env(safe-area-inset-right))] pl-[max(1.25rem,env(safe-area-inset-left))] sm:px-8">
        <a
          href="#top"
          className="rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Wordmark />
        </a>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-sm outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {item.label()}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LocaleSwitch />
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href={GITHUB_URL} target="_blank" rel="noreferrer" />}
          >
            <GithubMark data-icon="inline-start" className="size-4" />
            <span className="max-sm:sr-only">{m.nav_github()}</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
