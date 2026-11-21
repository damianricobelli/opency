import { Check } from "lucide-react";
import { type CSSProperties, type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { useInView } from "../lib/use-in-view";
import { Reveal } from "./reveal";
import { Section } from "./section";

/** How long each step stays up while the demo plays itself. */
const STEPS = [
  { title: m.setup_1_title, body: m.setup_1_body, ms: 5200 },
  { title: m.setup_2_title, body: m.setup_2_body, ms: 5600 },
  { title: m.setup_3_title, body: m.setup_3_body, ms: 5200 },
  { title: m.setup_4_title, body: m.setup_4_body, ms: 5600 },
] as const;

/** The demo brand's palette (the "natural" preset): what the agent found. */
const SWATCHES = [
  "#1F3A2D",
  "#4A5D3A",
  "#C8693A",
  "#F3EEE3",
  "#E5DECE",
] as const;
const READING = [
  { label: m.setup_read_colors, value: m.setup_read_colors_v, swatches: true },
  { label: m.setup_read_type, value: m.setup_read_type_v },
  { label: m.setup_read_logo, value: m.setup_read_logo_v },
  { label: m.setup_read_contrast, value: m.setup_read_contrast_v },
] as const;
const GOAL = [
  {
    label: m.setup_goal_objective,
    options: [m.setup_obj_1, m.setup_obj_2, m.setup_obj_3, m.setup_obj_4],
    picked: 1,
  },
  {
    label: m.setup_goal_audience,
    options: [m.setup_aud_1, m.setup_aud_2, m.setup_aud_3],
    picked: 0,
  },
  {
    label: m.setup_goal_offer,
    options: [m.setup_offer_1, m.setup_offer_2, m.setup_offer_3],
    picked: 0,
  },
] as const;
const IDEAS = [m.setup_idea_1, m.setup_idea_2, m.setup_idea_3] as const;
const FIRST_PIECE = [1, 2, 3, 4] as const;

/** `--i` is the element's place in its step's entrance (`.stage-item`). */
const at = (i: number) => ({ "--i": i }) as CSSProperties;

/** One of the four visuals. All share a grid cell, so the frame never resizes. */
function Panel({
  index,
  active,
  className,
  children,
}: {
  index: number;
  active: number;
  className?: string;
  children: ReactNode;
}) {
  const shown = index === active;
  return (
    <div
      id={`setup-panel-${index}`}
      role="tabpanel"
      aria-labelledby={`setup-tab-${index}`}
      aria-hidden={!shown}
      data-active={shown || undefined}
      className={cn(
        "swap-panel col-start-1 row-start-1 flex min-w-0 flex-col justify-center",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Bubble({
  from,
  i,
  children,
}: {
  from: "user" | "agent";
  i: number;
  children: ReactNode;
}) {
  return (
    <p
      style={at(i)}
      className={cn(
        "stage-item max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
        from === "user"
          ? "self-end rounded-br-md bg-foreground text-background"
          : "self-start rounded-bl-md bg-muted",
      )}
    >
      {children}
    </p>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[0.6875rem] tracking-wide text-muted-foreground uppercase">
      {children}
    </p>
  );
}

export function SetupSection() {
  const [active, setActive] = useState(0);
  // Play only while the demo is on screen: a timer nobody sees is wasted work,
  // and the reader should meet step one, not wherever it got to.
  const [ref, inView] = useInView<HTMLDivElement>({
    rootMargin: "0px 0px -20% 0px",
  });

  return (
    <Section.Root id="setup">
      <Section.Header>
        <Section.Eyebrow>{m.setup_eyebrow()}</Section.Eyebrow>
        <Section.Title>{m.setup_title()}</Section.Title>
        <Section.Lead>{m.setup_lead()}</Section.Lead>
      </Section.Header>

      <Reveal delay={80} className="mt-8 sm:mt-12">
        <div
          ref={ref}
          data-playing={inView || undefined}
          className="setup-demo grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-6"
        >
          <div
            role="tablist"
            aria-label={m.setup_tabs_label()}
            className="grid grid-cols-2 gap-2 lg:grid-cols-1"
          >
            {STEPS.map((step, index) => (
              <button
                key={index}
                type="button"
                role="tab"
                id={`setup-tab-${index}`}
                aria-selected={active === index}
                aria-controls={`setup-panel-${index}`}
                onClick={() => setActive(index)}
                className="step-tab group relative overflow-hidden rounded-xl border bg-card p-3 text-left sm:p-4"
              >
                <span className="flex items-center gap-2.5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full border font-mono text-[0.6875rem] text-muted-foreground transition-colors duration-200 group-aria-selected:border-brand group-aria-selected:bg-brand group-aria-selected:text-brand-foreground">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium">{step.title()}</span>
                </span>
                <span className="mt-2 hidden text-sm leading-relaxed text-muted-foreground lg:block">
                  {step.body()}
                </span>
                {/* The step's clock. When it runs out the next step starts, so
                    pausing the bar (hover, focus) pauses the whole demo. */}
                {active === index ? (
                  <span
                    aria-hidden
                    className="step-progress"
                    style={{ "--step-time": `${step.ms}ms` } as CSSProperties}
                    onAnimationEnd={() =>
                      setActive((current) => (current + 1) % STEPS.length)
                    }
                  />
                ) : null}
              </button>
            ))}
          </div>

          <div className="flex min-w-0 flex-col">
            {/* On a phone the tabs only carry titles; the active step's text sits here. */}
            <p className="mb-3 min-h-[4.5em] text-sm leading-relaxed text-muted-foreground lg:hidden">
              {STEPS[active]?.body()}
            </p>
            <div className="grid flex-1 overflow-hidden rounded-2xl border bg-card p-3 sm:p-6">
              <Panel index={0} active={active} className="gap-3">
                <Bubble from="user" i={0}>
                  {m.setup_user_1()}
                </Bubble>
                <Bubble from="agent" i={1}>
                  {m.setup_agent_1()}
                </Bubble>
                <div
                  style={at(2)}
                  className="stage-item w-full max-w-md self-start rounded-xl border bg-background"
                >
                  <p className="flex items-center gap-2 border-b px-3.5 py-2.5 font-mono text-xs text-muted-foreground">
                    <span
                      aria-hidden
                      className="size-1.5 rounded-full bg-brand"
                    />
                    {m.setup_read_title()}
                  </p>
                  <ul className="divide-y">
                    {READING.map((row, index) => (
                      <li
                        key={index}
                        style={at(3 + index)}
                        className="stage-item grid grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-x-2.5 px-3.5 py-2.5 text-sm"
                      >
                        <Check
                          aria-hidden
                          className="size-3.5 text-brand"
                          strokeWidth={2.5}
                        />
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-medium">{row.label()}</span>
                          <span className="text-muted-foreground">
                            {row.value()}
                          </span>
                          {"swatches" in row ? (
                            <span aria-hidden className="flex gap-1">
                              {SWATCHES.map((color) => (
                                <span
                                  key={color}
                                  className="size-3.5 rounded-full border border-foreground/10"
                                  style={{ background: color }}
                                />
                              ))}
                            </span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Bubble from="agent" i={8}>
                  {m.setup_agent_2()}
                </Bubble>
              </Panel>

              <Panel index={1} active={active} className="gap-3">
                <img
                  src="/examples/brand-board.webp"
                  alt={m.setup_board_alt()}
                  width={1500}
                  height={933}
                  loading="lazy"
                  decoding="async"
                  style={at(0)}
                  className="stage-item stage-image h-auto w-full rounded-lg"
                />
                <p
                  style={at(2)}
                  className="stage-item text-center text-xs text-muted-foreground"
                >
                  {m.setup_board_caption()}
                </p>
              </Panel>

              <Panel index={2} active={active} className="gap-6 sm:px-2">
                {GOAL.map((group, g) => (
                  <div
                    key={g}
                    style={at(g * 3)}
                    className="stage-item space-y-2.5"
                  >
                    <Label>{group.label()}</Label>
                    <div className="flex flex-wrap gap-2">
                      {group.options.map((option, index) => (
                        <span
                          key={index}
                          data-picked={index === group.picked || undefined}
                          style={at(g * 3 + 2)}
                          className="stage-chip rounded-full border px-3 py-1.5 text-xs text-muted-foreground sm:text-sm"
                        >
                          {option()}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                <p
                  style={at(9)}
                  className="stage-item text-xs text-muted-foreground"
                >
                  {m.setup_goal_note()}
                </p>
              </Panel>

              <Panel index={3} active={active} className="gap-4">
                <div style={at(0)} className="stage-item space-y-2.5">
                  <Label>{m.setup_idea_label()}</Label>
                  <div className="flex flex-wrap gap-2">
                    {IDEAS.map((idea, index) => (
                      <span
                        key={index}
                        data-picked={index === 0 || undefined}
                        style={at(2)}
                        className="stage-chip rounded-full border px-3 py-1.5 text-xs text-muted-foreground sm:text-sm"
                      >
                        {idea()}
                      </span>
                    ))}
                  </div>
                </div>
                <div
                  role="img"
                  aria-label={m.setup_piece_alt()}
                  className="grid grid-cols-4 gap-2 sm:gap-3"
                >
                  {FIRST_PIECE.map((n) => (
                    <img
                      key={n}
                      src={`/examples/v1-slide-0${n}.webp`}
                      alt=""
                      width={540}
                      height={675}
                      loading="lazy"
                      decoding="async"
                      style={at(3 + n)}
                      className="stage-item stage-image h-auto w-full rounded-md sm:rounded-lg"
                    />
                  ))}
                </div>
                <p
                  style={at(9)}
                  className="stage-item flex items-center gap-2 font-mono text-xs text-muted-foreground"
                >
                  <span
                    aria-hidden
                    className="size-1.5 rounded-full bg-brand"
                  />
                  {m.setup_piece_status()}
                </p>
              </Panel>
            </div>
            <p className="mt-3 text-xs text-muted-foreground max-lg:hidden">
              {m.setup_pause_hint()}
            </p>
          </div>
        </div>
      </Reveal>
    </Section.Root>
  );
}
