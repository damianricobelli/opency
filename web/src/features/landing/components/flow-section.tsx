import { m } from "@/paraglide/messages";
import { Reveal } from "./reveal";
import { Section } from "./section";

const STEPS = [
  { title: m.flow_1_title, body: m.flow_1_body },
  { title: m.flow_2_title, body: m.flow_2_body },
  { title: m.flow_3_title, body: m.flow_3_body },
  { title: m.flow_4_title, body: m.flow_4_body },
  { title: m.flow_5_title, body: m.flow_5_body },
  { title: m.flow_6_title, body: m.flow_6_body },
] as const;

/** Uneven on purpose: a constant step reads as a machine. */
const STAGGER = [0, 50, 90, 0, 50, 90] as const;

export function FlowSection() {
  return (
    <Section.Root id="flow">
      <Section.Header>
        <Section.Eyebrow>{m.flow_eyebrow()}</Section.Eyebrow>
        <Section.Title>{m.flow_title()}</Section.Title>
        <Section.Lead>{m.flow_lead()}</Section.Lead>
      </Section.Header>
      <ol className="mt-10 grid gap-x-10 gap-y-8 sm:mt-14 sm:grid-cols-2 sm:gap-y-12 lg:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={index}>
            <Reveal delay={STAGGER[index]} className="border-t pt-4 sm:pt-5">
              <span className="font-mono text-xs text-brand">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-2 font-display text-2xl leading-tight sm:mt-3">
                {step.title()}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">
                {step.body()}
              </p>
            </Reveal>
          </li>
        ))}
      </ol>
    </Section.Root>
  );
}
