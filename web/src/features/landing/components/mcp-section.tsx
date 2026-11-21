import { m } from "@/paraglide/messages";
import { Reveal } from "./reveal";
import { Section } from "./section";

const GROUPS = [
  {
    label: m.mcp_group_brand,
    tools: ["brand_get", "brand_import_site", "brand_fonts", "brand_check"],
  },
  {
    label: m.mcp_group_brief,
    tools: ["brief_questions", "brief_interview"],
  },
  {
    label: m.mcp_group_campaign,
    tools: [
      "campaign_create",
      "campaign_brief",
      "campaign_plan",
      "campaign_status",
    ],
  },
  {
    label: m.mcp_group_images,
    tools: ["stock_search", "stock_import", "asset_analyze"],
  },
  {
    label: m.mcp_group_pieces,
    tools: [
      "piece_design",
      "piece_variant",
      "piece_feedback",
      "piece_repair",
      "piece_preview",
      "piece_handoff",
    ],
  },
  {
    label: m.mcp_group_feed,
    tools: ["feed_check", "results_add"],
  },
] as const;

const STAGGER = [0, 50, 90, 0, 50, 90] as const;

export function McpSection() {
  return (
    <Section.Root id="mcp">
      <Section.Header>
        <Section.Eyebrow>{m.mcp_eyebrow()}</Section.Eyebrow>
        <Section.Title>{m.mcp_title()}</Section.Title>
        <Section.Lead>{m.mcp_lead()}</Section.Lead>
      </Section.Header>
      <div className="mt-10 grid gap-px sm:mt-14 overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {GROUPS.map((group, index) => (
          <div key={index} className="bg-card p-4 sm:p-6">
            <Reveal delay={STAGGER[index]}>
              <h3 className="text-sm font-medium">{group.label()}</h3>
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {group.tools.map((tool) => (
                  <li
                    key={tool}
                    className="rounded-md bg-muted px-2 py-1 font-mono text-xs text-muted-foreground"
                  >
                    {tool}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        ))}
      </div>
    </Section.Root>
  );
}
