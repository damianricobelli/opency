import { ArrowDown } from "lucide-react";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { GITHUB_URL } from "@/lib/site";
import { m } from "@/paraglide/messages";
import { INSTALL_COMMANDS } from "../lib/site";
import { CodeBlock } from "./code-block";
import { GithubMark } from "./github-mark";
import { HeroStage } from "./hero-stage";

const delay = (ms: number) => ({ "--rise-delay": `${ms}ms` }) as CSSProperties;

export function Hero() {
  return (
    <section
      id="top"
      // `svh`: the smallest the viewport gets, so the URL bar collapsing
      // never shifts the page under the reader.
      className="relative flex min-h-[calc(100svh-3.5rem)] flex-col overflow-hidden px-5 pt-10 pb-8 sm:items-center sm:px-8 sm:pt-24 sm:pb-10"
    >
      <div aria-hidden className="hero-grid absolute inset-0 -z-10" />
      {/* Phones read it as a column from the left edge: a centered stack of
          short blocks has no hierarchy at 320px. */}
      <div className="flex max-w-3xl flex-col items-start sm:items-center sm:text-center">
        <p
          className="rise flex items-center gap-2 rounded-full border bg-card px-3 py-1 font-mono text-xs text-muted-foreground"
          style={delay(0)}
        >
          <span aria-hidden className="size-1.5 rounded-full bg-brand" />
          {m.hero_eyebrow()}
        </p>
        <h1
          className="rise mt-5 font-display text-[clamp(2.5rem,11.5vw,5.25rem)] leading-[0.98] tracking-tight text-balance sm:mt-6 sm:text-[clamp(3.25rem,8vw,5.25rem)]"
          style={delay(60)}
        >
          {m.hero_title_lead()}{" "}
          <em className="text-brand max-sm:block">{m.hero_title_accent()}</em>
        </h1>
        <p
          className="rise mt-5 max-w-[34ch] text-base leading-relaxed text-pretty text-muted-foreground sm:mt-6 sm:max-w-2xl sm:text-lg"
          style={delay(130)}
        >
          {/* The long version names every client; a phone gets the point. */}
          <span className="sm:hidden">{m.hero_lead_short()}</span>
          <span className="max-sm:hidden">{m.hero_lead()}</span>
        </p>
        <div
          className="rise mt-7 flex w-full max-w-md flex-col items-stretch gap-3 sm:mt-8"
          style={delay(190)}
        >
          <CodeBlock.Root code={INSTALL_COMMANDS.skill} className="text-left">
            <CodeBlock.Command />
            <CodeBlock.Copy />
          </CodeBlock.Root>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-center">
            <Button
              size="lg"
              nativeButton={false}
              render={<a href="#install" />}
            >
              {m.hero_cta_install()}
              <ArrowDown data-icon="inline-end" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              nativeButton={false}
              render={<a href={GITHUB_URL} target="_blank" rel="noreferrer" />}
            >
              <GithubMark data-icon="inline-start" className="size-4" />
              {m.hero_cta_github()}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground sm:text-center">
            {m.hero_note()}
          </p>
        </div>
      </div>
      <HeroStage
        label={m.hero_scene_label()}
        className="rise -mx-5 mt-8 w-[calc(100%+2.5rem)] self-center sm:mx-0 sm:mt-14 sm:w-full sm:max-w-5xl"
      />
    </section>
  );
}
