import { ArrowDown } from "lucide-react";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages";
import { GITHUB_URL, INSTALL_COMMANDS } from "../lib/site";
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
      className="relative flex min-h-[calc(100svh-3.5rem)] flex-col items-center overflow-hidden px-5 pt-16 pb-10 sm:px-8 sm:pt-24"
    >
      <div aria-hidden className="hero-grid absolute inset-0 -z-10" />
      <div className="flex max-w-3xl flex-col items-center text-center">
        <p
          className="rise flex items-center gap-2 rounded-full border bg-card px-3 py-1 font-mono text-xs text-muted-foreground"
          style={delay(0)}
        >
          <span aria-hidden className="size-1.5 rounded-full bg-brand" />
          {m.hero_eyebrow()}
        </p>
        <h1
          className="rise mt-6 font-display text-[clamp(2.75rem,8vw,5.25rem)] leading-[0.98] tracking-tight text-balance"
          style={delay(60)}
        >
          {m.hero_title_lead()}{" "}
          <em className="text-brand">{m.hero_title_accent()}</em>
        </h1>
        <p
          className="rise mt-6 max-w-2xl text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg"
          style={delay(130)}
        >
          {m.hero_lead()}
        </p>
        <div
          className="rise mt-8 flex w-full max-w-md flex-col items-stretch gap-3"
          style={delay(190)}
        >
          <CodeBlock.Root code={INSTALL_COMMANDS.skill} className="text-left">
            <CodeBlock.Command />
            <CodeBlock.Copy />
          </CodeBlock.Root>
          <div className="flex flex-wrap items-center justify-center gap-2">
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
          <p className="text-center text-sm text-muted-foreground">
            {m.hero_note()}
          </p>
        </div>
      </div>
      <HeroStage
        label={m.hero_scene_label()}
        className="rise mt-10 max-w-5xl sm:mt-14"
      />
    </section>
  );
}
