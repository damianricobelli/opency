import { m } from "@/paraglide/messages";
import { BriefDemo } from "./brief-demo";
import { Reveal } from "./reveal";
import { Section } from "./section";

export function BriefSection() {
  return (
    <Section.Root id="brief">
      <Section.Header>
        <Section.Eyebrow>{m.brief_eyebrow()}</Section.Eyebrow>
        <Section.Title>{m.brief_title()}</Section.Title>
        <Section.Lead>{m.brief_lead()}</Section.Lead>
      </Section.Header>
      <Reveal delay={80} className="mt-8 sm:mt-12">
        <BriefDemo />
      </Reveal>
    </Section.Root>
  );
}
