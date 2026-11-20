import { m } from "@/paraglide/messages";
import { Reveal } from "./reveal";
import { Section } from "./section";

const REASONS = [
  { title: m.why_1_title, body: m.why_1_body },
  { title: m.why_2_title, body: m.why_2_body },
  { title: m.why_3_title, body: m.why_3_body },
  { title: m.why_4_title, body: m.why_4_body },
  { title: m.why_5_title, body: m.why_5_body },
] as const;

export function WhySection() {
  return (
    <Section.Root id="why">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 sm:gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Section.Header className="lg:sticky lg:top-28 lg:self-start">
          <Section.Eyebrow>{m.why_eyebrow()}</Section.Eyebrow>
          <Section.Title>{m.why_title()}</Section.Title>
        </Section.Header>
        <dl>
          {REASONS.map((reason, index) => (
            <Reveal
              key={index}
              delay={Math.min(index, 2) * 45}
              className="grid gap-1 border-t py-5 sm:grid-cols-[11rem_1fr] sm:gap-6 sm:py-6"
            >
              <dt className="font-display text-2xl leading-tight">
                {reason.title()}
              </dt>
              <dd className="leading-relaxed text-pretty text-muted-foreground">
                {reason.body()}
              </dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </Section.Root>
  );
}
