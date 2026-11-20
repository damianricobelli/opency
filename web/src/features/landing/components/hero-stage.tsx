import { Check } from "lucide-react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { Reveal } from "./reveal";

/**
 * Real output: the five slides of the demo carousel, rendered by opency
 * (`pnpm hero-slides` refreshes them). Each one carries the quality check the
 * scan "passes" on it.
 *
 * `tilt` and `drop` shape a shallow arc; `at` is where the scan line meets the
 * slide, as a fraction of the row (`atNarrow` when only the middle three show).
 */
const SLIDES = [
  { n: 1, check: m.hero_check_1, tilt: -3, drop: 14, at: 0.1, atNarrow: 0 },
  { n: 2, check: m.hero_check_2, tilt: -1.5, drop: 4, at: 0.3, atNarrow: 0.17 },
  { n: 3, check: m.hero_check_3, tilt: 0, drop: 0, at: 0.5, atNarrow: 0.5 },
  { n: 4, check: m.hero_check_4, tilt: 1.5, drop: 4, at: 0.7, atNarrow: 0.83 },
  { n: 5, check: m.hero_check_5, tilt: 3, drop: 14, at: 0.9, atNarrow: 1 },
] as const;

/**
 * The product in one picture: a finished carousel going through quality
 * control. Slides settle into a row, a scan line crosses them, each check
 * lands as the line passes, and the report closes with zero errors.
 * All motion is CSS (`.hero-stage` in `styles.css`) and plays once in view.
 */
export function HeroStage({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <Reveal
      role="img"
      aria-label={label}
      className={cn("hero-stage flex flex-col items-center", className)}
    >
      <div className="relative flex items-start justify-center gap-[3vw] sm:gap-4 lg:gap-5">
        {SLIDES.map((slide, index) => (
          <figure
            key={slide.n}
            style={
              {
                "--i": index,
                "--tilt": `${slide.tilt}deg`,
                "--drop": `${slide.drop}px`,
                "--at": slide.at,
                "--at-narrow": slide.atNarrow,
              } as CSSProperties
            }
            className={cn(
              "hs-slide w-[28vw] max-w-36 sm:w-[clamp(6rem,15vw,11.5rem)] sm:max-w-none",
              // Phones show the middle three, whole: nothing is cropped.
              (index === 0 || index === SLIDES.length - 1) && "max-sm:hidden",
            )}
          >
            <div className="hs-card relative overflow-hidden rounded-[7%] border border-border bg-card shadow-[0_14px_30px_-18px_color-mix(in_oklch,var(--foreground)_45%,transparent)]">
              <img
                src={`/hero/slide-0${slide.n}.webp`}
                alt=""
                width={600}
                height={750}
                decoding="async"
                draggable={false}
                className="block h-auto w-full select-none"
              />
              {/* The safe area the render measures against. */}
              <span className="hs-guide pointer-events-none absolute inset-[7%] rounded-[4%] border border-dashed border-brand" />
            </div>
            <figcaption className="hs-check mt-3 flex items-center justify-center gap-1 font-mono text-[10px] whitespace-nowrap text-muted-foreground sm:mt-4 sm:text-xs">
              <Check aria-hidden className="size-3 shrink-0 text-brand" />
              {slide.check()}
            </figcaption>
          </figure>
        ))}
        {/* The scan: a full-width layer whose right edge is the line. */}
        <span
          aria-hidden
          className="hs-scan pointer-events-none absolute inset-x-0 -top-3 bottom-6 border-r-2 border-brand bg-linear-to-l from-brand/10 to-transparent to-25% sm:bottom-8"
        />
      </div>
      <p className="hs-status mt-5 flex items-center gap-2 rounded-full border bg-card px-3 py-1 font-mono text-xs text-muted-foreground sm:mt-7">
        <span className="size-1.5 rounded-full bg-brand" />
        {m.hero_stage_status()}
      </p>
    </Reveal>
  );
}
