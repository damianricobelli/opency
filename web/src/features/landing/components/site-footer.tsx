import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages";
import { GITHUB_URL, INSTALL_COMMANDS } from "../lib/site";
import { CodeBlock } from "./code-block";
import { GithubMark } from "./github-mark";
import { Reveal } from "./reveal";
import { Wordmark } from "./site-header";

export function ClosingSection() {
  return (
    <section className="border-t px-5 py-24 sm:px-8 sm:py-32">
      <Reveal className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
        <h2 className="font-display text-5xl leading-[1.02] tracking-tight text-balance sm:text-6xl">
          {m.cta_title()}
        </h2>
        <p className="text-lg text-muted-foreground">{m.cta_lead()}</p>
        <CodeBlock.Root
          code={INSTALL_COMMANDS.skill}
          className="w-full max-w-md text-left"
        >
          <CodeBlock.Command />
          <CodeBlock.Copy />
        </CodeBlock.Root>
        <Button
          size="lg"
          variant="outline"
          nativeButton={false}
          render={<a href={GITHUB_URL} target="_blank" rel="noreferrer" />}
        >
          <GithubMark data-icon="inline-start" className="size-4" />
          {m.hero_cta_github()}
        </Button>
      </Reveal>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="flex items-center gap-4 text-foreground">
          <Wordmark />
        </div>
        <p>{m.footer_tagline()}</p>
        <p className="font-mono text-xs">{m.footer_license()}</p>
      </div>
    </footer>
  );
}
