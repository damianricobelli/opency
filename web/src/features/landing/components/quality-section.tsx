import { m } from "@/paraglide/messages";
import { Reveal } from "./reveal";
import { Section } from "./section";

const CHECKS = [
  { label: m.quality_check_contrast, status: m.quality_status_ok },
  { label: m.quality_check_safe, status: m.quality_status_ok },
  { label: m.quality_check_widows, status: m.quality_status_fixed },
  { label: m.quality_check_faces, status: m.quality_status_ok },
  { label: m.quality_check_figures, status: m.quality_status_ok },
  { label: m.quality_check_slop, status: m.quality_status_fixed },
] as const;

/** A slide as the checker sees it: safe zone, focal point, covered strip. */
function MeasuredSlide() {
  return (
    <div
      aria-hidden
      className="relative mx-auto aspect-[4/5] w-full max-w-[17rem] overflow-hidden rounded-xl bg-foreground text-background"
    >
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_70%_20%,color-mix(in_oklch,var(--brand)_55%,transparent),transparent_60%)]" />
      {/* Safe zone. */}
      <div className="absolute inset-[7.4%] rounded-md border border-dashed border-background/50" />
      {/* The strip each network covers with its own interface. */}
      <div className="absolute inset-x-0 bottom-0 h-[18.5%] bg-[repeating-linear-gradient(135deg,transparent_0_6px,color-mix(in_oklch,var(--background)_22%,transparent)_6px_7px)]" />
      {/* Focal point. */}
      <div className="absolute top-[24%] left-[66%] size-7 -translate-1/2 rounded-full border border-background/80">
        <span className="absolute top-1/2 left-1/2 size-1 -translate-1/2 rounded-full bg-background" />
      </div>
      <div className="absolute inset-x-[12%] top-[46%] grid gap-2">
        <span className="h-3 w-[88%] rounded-full bg-current" />
        <span className="h-3 w-[64%] rounded-full bg-current" />
        <span className="mt-1 w-fit rounded-sm bg-background px-1.5 py-0.5 font-mono text-[10px] text-foreground">
          AA
        </span>
      </div>
    </div>
  );
}

export function QualitySection() {
  return (
    <Section.Root id="quality">
      <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Section.Header>
          <Section.Eyebrow>{m.quality_eyebrow()}</Section.Eyebrow>
          <Section.Title>{m.quality_title()}</Section.Title>
          <Section.Lead>{m.quality_lead()}</Section.Lead>
        </Section.Header>
        <Reveal
          delay={80}
          className="grid items-center gap-6 rounded-2xl border bg-card p-5 sm:grid-cols-[auto_1fr] sm:p-6"
        >
          <MeasuredSlide />
          <div className="min-w-0">
            <p className="font-mono text-xs text-muted-foreground">
              {m.quality_report_title()}
            </p>
            <ul className="mt-3">
              {CHECKS.map((check, index) => (
                <li
                  key={index}
                  className="flex items-baseline justify-between gap-4 border-b py-2.5 text-sm last:border-b-0"
                >
                  <span className="text-pretty">{check.label()}</span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {check.status()}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 font-mono text-xs text-brand">
              {m.quality_summary()}
            </p>
          </div>
        </Reveal>
      </div>
    </Section.Root>
  );
}
