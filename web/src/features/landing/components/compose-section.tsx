import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { m } from "@/paraglide/messages";
import { Reveal } from "./reveal";
import { Section } from "./section";

/** Roles, recipe ids and the slide copy are the product's own words: not translated. */
const SLIDES = [
  {
    role: "hook",
    claim: "Cold is not lazy.",
    recipes: ["type_poster", "type_poster"],
    reasons: [m.compose_reason_a1, m.compose_reason_b1],
  },
  {
    role: "how",
    claim: "How we brew it · 3 steps",
    recipes: ["steps", "steps_cards"],
    reasons: [m.compose_reason_a2, m.compose_reason_b2],
  },
  {
    role: "proof",
    claim: "18 · hours in every glass",
    recipes: ["type_number", "number_poster"],
    reasons: [m.compose_reason_a3, m.compose_reason_b3],
  },
  {
    role: "close",
    claim: "Try it before the heat does.",
    recipes: ["type_closer", "type_closer"],
    reasons: [m.compose_reason_a4, m.compose_reason_b4],
  },
] as const;

const FACTS = [m.compose_fact_1, m.compose_fact_2, m.compose_fact_3] as const;
const VERSIONS = [0, 1] as const;

/** Two values in one cell: the row keeps its size while they trade places. */
function Swap({
  version,
  values,
  className,
}: {
  version: number;
  values: readonly [string, string];
  className?: string;
}) {
  return (
    <span className="grid">
      {VERSIONS.map((v) => (
        <span
          key={v}
          aria-hidden={v !== version}
          data-active={v === version || undefined}
          className={`swap-text col-start-1 row-start-1 ${className ?? ""}`}
        >
          {values[v]}
        </span>
      ))}
    </span>
  );
}

export function ComposeSection() {
  const [version, setVersion] = useState(0);

  return (
    <Section.Root id="compose">
      <Section.Header>
        <Section.Eyebrow>{m.compose_eyebrow()}</Section.Eyebrow>
        <Section.Title>{m.compose_title()}</Section.Title>
        <Section.Lead>{m.compose_lead()}</Section.Lead>
      </Section.Header>

      <Reveal
        delay={80}
        className="mt-8 overflow-hidden rounded-2xl border bg-card sm:mt-12"
      >
        <div className="grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          <ol className="divide-y border-b lg:border-r lg:border-b-0">
            <li className="hidden grid-cols-2 gap-4 px-5 py-3 font-mono text-[0.6875rem] tracking-wide text-muted-foreground uppercase lg:grid">
              <span>{m.compose_col_intent()}</span>
              <span>{m.compose_col_choice()}</span>
            </li>
            {SLIDES.map((slide, index) => (
              <li
                key={slide.role}
                className="grid gap-x-4 gap-y-1.5 px-4 py-3.5 sm:grid-cols-2 sm:px-5"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-mono text-[0.6875rem] text-muted-foreground">
                    {String(index + 1).padStart(2, "0")} · {slide.role}
                  </p>
                  <p className="text-sm leading-snug">{slide.claim}</p>
                </div>
                <div className="min-w-0 space-y-1">
                  <Swap
                    version={version}
                    values={slide.recipes}
                    className="font-mono text-[0.6875rem] text-brand"
                  />
                  <Swap
                    version={version}
                    values={[slide.reasons[0](), slide.reasons[1]()]}
                    className="text-sm leading-snug text-muted-foreground"
                  />
                </div>
              </li>
            ))}
          </ol>

          <div className="flex min-w-0 flex-col gap-4 p-4 sm:p-5">
            <div
              role="img"
              aria-label={
                version === 0
                  ? m.compose_slides_alt_a()
                  : m.compose_slides_alt_b()
              }
              className="grid grid-cols-4 gap-2 sm:gap-3"
            >
              {SLIDES.map((slide, index) => (
                <div key={slide.role} className="grid">
                  {VERSIONS.map((v) => (
                    <img
                      key={v}
                      src={`/examples/v${v + 1}-slide-0${index + 1}.webp`}
                      alt=""
                      width={540}
                      height={675}
                      loading="lazy"
                      decoding="async"
                      data-active={v === version || undefined}
                      className="swap-slide col-start-1 row-start-1 h-auto w-full rounded-md sm:rounded-lg"
                      style={
                        {
                          "--swap-delay": `${index * 45}ms`,
                        } as React.CSSProperties
                      }
                    />
                  ))}
                </div>
              ))}
            </div>

            <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-3">
              <button
                type="button"
                aria-pressed={version === 1}
                onClick={() => setVersion((current) => (current === 0 ? 1 : 0))}
                className="press inline-flex h-10 items-center gap-2 rounded-full bg-foreground px-4 text-sm font-medium text-background"
              >
                <RefreshCw aria-hidden className="size-3.5" />
                {version === 0 ? m.compose_variant() : m.compose_variant_back()}
              </button>
              <p className="min-w-0 flex-1 basis-56 text-sm text-pretty text-muted-foreground">
                {m.compose_same_words()}
              </p>
            </div>
          </div>
        </div>

        <ul className="grid gap-px border-t bg-border sm:grid-cols-3">
          {FACTS.map((fact, index) => (
            <li
              key={index}
              className="bg-card px-4 py-3 text-sm text-muted-foreground sm:px-5"
            >
              {fact()}
            </li>
          ))}
        </ul>
      </Reveal>
    </Section.Root>
  );
}
