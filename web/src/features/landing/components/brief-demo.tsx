import { RotateCcw } from "lucide-react";
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  use,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { useInView } from "../lib/use-in-view";
import { useSequence } from "../lib/use-sequence";

/** Pause before each step. Questions take longer to "write" than answers. */
const STEP_DELAYS = [500, 1100, 1300, 1100, 1400, 1100, 1400, 1300] as const;
const LAST_STEP = STEP_DELAYS.length;

const StepContext = createContext(0);

/** Visible from step `at` on; laid out from the start so nothing jumps. */
function Shown({
  at,
  className,
  ...props
}: ComponentProps<"div"> & { at: number }) {
  const shown = use(StepContext) >= at;
  return (
    <div
      data-shown={shown || undefined}
      aria-hidden={!shown}
      className={cn("demo-item", className)}
      {...props}
    />
  );
}

function AgentMessage({ at, children }: { at: number; children: ReactNode }) {
  return (
    <Shown at={at} className="max-w-[85%] space-y-2 self-start">
      <div className="rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5 text-sm leading-relaxed">
        {children}
      </div>
    </Shown>
  );
}

function UserMessage({ at, children }: { at: number; children: ReactNode }) {
  return (
    <Shown
      at={at}
      className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-foreground px-3.5 py-2.5 text-sm leading-relaxed text-background"
    >
      {children}
    </Shown>
  );
}

function Choice({
  picked,
  children,
}: {
  picked?: number;
  children: ReactNode;
}) {
  const step = use(StepContext);
  const selected = picked !== undefined && step >= picked;
  return (
    <span
      data-selected={selected || undefined}
      className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition-[background-color,border-color,color] duration-200 ease-out data-selected:border-brand data-selected:bg-brand data-selected:text-brand-foreground"
    >
      {children}
    </span>
  );
}

function TypingDots() {
  const step = use(StepContext);
  // The agent writes before its messages (odd steps) while the demo runs.
  const typing = step > 0 && step < LAST_STEP && step % 2 === 0;
  return (
    <span
      aria-hidden
      className={cn(
        "flex items-center gap-1 transition-opacity duration-200",
        typing ? "opacity-100" : "opacity-0",
      )}
    >
      {[0, 150, 300].map((dotDelay) => (
        <span
          key={dotDelay}
          className="typing-dot size-1 rounded-full bg-muted-foreground"
          style={{ "--dot-delay": `${dotDelay}ms` } as React.CSSProperties}
        />
      ))}
    </span>
  );
}

function Field({
  at,
  name,
  children,
}: {
  at: number;
  name: string;
  children: ReactNode;
}) {
  const filled = use(StepContext) >= at;
  return (
    <div className="grid grid-cols-[6.5rem_1fr] items-baseline gap-3 border-b py-2.5 font-mono text-xs last:border-b-0">
      <dt className="text-muted-foreground">{name}</dt>
      <dd className="grid">
        {/* Both values share one cell, so the row never changes height. */}
        <span
          className={cn(
            "col-start-1 row-start-1 text-muted-foreground/60 transition-opacity duration-200",
            filled && "opacity-0",
          )}
        >
          {m.demo_pending()}
        </span>
        <span
          className={cn(
            "col-start-1 row-start-1 opacity-0 transition-opacity duration-300 ease-out",
            filled && "opacity-100",
          )}
        >
          {children}
        </span>
      </dd>
    </div>
  );
}

const THUMBNAILS = [0, 1, 2, 3, 4, 5] as const;

function PieceCard() {
  return (
    <Shown at={8} className="space-y-3 rounded-xl border bg-card p-3">
      <div className="grid grid-cols-6 gap-1.5">
        {THUMBNAILS.map((index) => (
          <div
            key={index}
            className={cn(
              "flex aspect-[4/5] flex-col justify-end gap-[3px] rounded-[4px] p-[3px]",
              index === 0 ? "bg-foreground text-background" : "bg-muted",
            )}
          >
            <span className="h-[2px] w-4/5 rounded-full bg-current opacity-80" />
            <span
              className={cn(
                "h-[2px] w-1/2 rounded-full",
                index === 0 ? "bg-brand" : "bg-current opacity-40",
              )}
            />
          </div>
        ))}
      </div>
      <p className="font-display text-xl leading-tight">
        {m.demo_piece_cover()}
      </p>
      <p className="font-mono text-[11px] text-muted-foreground">
        {m.demo_piece_meta()}
      </p>
    </Shown>
  );
}

function Conversation() {
  return (
    <div className="flex flex-col gap-3 p-4 sm:p-5">
      <UserMessage at={1}>{m.demo_user_request()}</UserMessage>
      <AgentMessage at={2}>
        <p>{m.demo_q_message()}</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Choice picked={3}>{m.demo_q_message_opt_a()}</Choice>
          <Choice>{m.demo_q_message_opt_b()}</Choice>
          <Choice>{m.demo_q_message_opt_c()}</Choice>
        </div>
      </AgentMessage>
      <UserMessage at={3}>{m.demo_q_message_opt_a()}</UserMessage>
      <AgentMessage at={4}>{m.demo_q_audience()}</AgentMessage>
      <UserMessage at={5}>{m.demo_a_audience()}</UserMessage>
      <AgentMessage at={6}>{m.demo_q_facts()}</AgentMessage>
      <UserMessage at={7}>{m.demo_a_facts()}</UserMessage>
      <AgentMessage at={8}>{m.demo_result()}</AgentMessage>
    </div>
  );
}

function Brief() {
  return (
    <div className="flex flex-col gap-4 border-t bg-background/60 p-4 sm:p-5 lg:border-t-0 lg:border-l">
      <p className="font-mono text-xs text-muted-foreground">
        {m.demo_brief_file()}
      </p>
      <dl>
        <Field at={1} name={m.demo_field_goal()}>
          {m.demo_value_goal()}
        </Field>
        <Field at={3} name={m.demo_field_message()}>
          {m.demo_q_message_opt_a()}
        </Field>
        <Field at={5} name={m.demo_field_audience()}>
          {m.demo_value_audience()}
        </Field>
        <Field at={5} name={m.demo_field_channels()}>
          {m.demo_value_channels()}
        </Field>
        <Field at={7} name={m.demo_field_verified()}>
          {m.demo_value_verified()}
        </Field>
      </dl>
      <PieceCard />
    </div>
  );
}

/** One run of the scripted conversation; remounted to replay. */
function Run({ active, children }: { active: boolean; children: ReactNode }) {
  const step = useSequence(STEP_DELAYS, active);
  return <StepContext value={step}>{children}</StepContext>;
}

/**
 * A scripted conversation with a made-up brand: the agent asks, the answers
 * fill the brief, and the piece comes last. It starts when it scrolls into
 * view and is labelled as a demo.
 */
export function BriefDemo({ className }: { className?: string }) {
  const [frame, seen] = useInView<HTMLDivElement>({
    once: true,
    rootMargin: "0px 0px -25% 0px",
  });
  const [run, setRun] = useState(0);

  return (
    <div
      ref={frame}
      className={cn(
        "overflow-hidden rounded-2xl border bg-card shadow-[0_24px_60px_-40px_color-mix(in_oklch,var(--foreground)_45%,transparent)]",
        className,
      )}
    >
      <Run key={run} active={seen}>
        <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5 sm:px-5">
          <p className="flex items-center gap-2.5 font-mono text-xs text-muted-foreground">
            {m.demo_label()}
            <TypingDots />
          </p>
          <button
            type="button"
            onClick={() => setRun((current) => current + 1)}
            className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs text-muted-foreground outline-none transition-[background-color,color,scale] duration-150 ease-out hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.97] motion-reduce:active:scale-100"
          >
            <RotateCcw aria-hidden className="size-3.5" />
            {m.demo_replay()}
          </button>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <Conversation />
          <Brief />
        </div>
      </Run>
    </div>
  );
}
