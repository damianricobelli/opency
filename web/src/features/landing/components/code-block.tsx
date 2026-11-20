import { Check, Copy as CopyIcon } from "lucide-react";
import {
  type ComponentProps,
  createContext,
  use,
  useEffect,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

const CodeContext = createContext<string | null>(null);

function useCode() {
  const code = use(CodeContext);
  if (code === null) throw new Error("CodeBlock parts need <CodeBlock.Root>");
  return code;
}

/** A command or snippet; `code` is what the copy button puts on the clipboard. */
function Root({
  code,
  className,
  ...props
}: ComponentProps<"div"> & { code: string }) {
  return (
    <CodeContext value={code}>
      <div
        className={cn(
          "flex items-start gap-2 rounded-xl border bg-card py-2 pr-2 pl-4 font-mono text-[13px] leading-6",
          className,
        )}
        {...props}
      />
    </CodeContext>
  );
}

/** One line with a prompt mark; scrolls sideways instead of wrapping. */
function Command({ className, ...props }: ComponentProps<"code">) {
  const code = useCode();
  return (
    <code
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2 overflow-x-auto overscroll-x-contain py-1.5 whitespace-nowrap [scrollbar-width:none]",
        className,
      )}
      {...props}
    >
      <span aria-hidden className="text-brand select-none">
        $
      </span>
      {code}
    </code>
  );
}

/** A multi-line snippet. */
function Snippet({ className, ...props }: ComponentProps<"pre">) {
  const code = useCode();
  return (
    <pre
      className={cn(
        "min-w-0 flex-1 overflow-x-auto overscroll-x-contain py-1.5 [scrollbar-width:none]",
        className,
      )}
      {...props}
    >
      <code>{code}</code>
    </pre>
  );
}

function Copy({ className, ...props }: ComponentProps<"button">) {
  const code = useCode();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      aria-label={copied ? m.copied() : m.copy()}
      data-copied={copied || undefined}
      onClick={() => {
        navigator.clipboard.writeText(code).then(
          () => setCopied(true),
          () => {},
        );
      }}
      className={cn(
        "group/copy relative grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground outline-none transition-[background-color,color,scale] duration-150 ease-out hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.97] motion-reduce:active:scale-100",
        className,
      )}
      {...props}
    >
      {/* Both icons stay mounted and crossfade; the blur hides the moment
          the two overlap. */}
      <CopyIcon
        aria-hidden
        className="col-start-1 row-start-1 size-4 transition-[opacity,scale,filter] duration-200 ease-out group-data-copied/copy:scale-75 group-data-copied/copy:opacity-0 group-data-copied/copy:blur-[2px]"
      />
      <Check
        aria-hidden
        className="col-start-1 row-start-1 size-4 scale-75 text-brand opacity-0 blur-[2px] transition-[opacity,scale,filter] duration-200 ease-out group-data-copied/copy:scale-100 group-data-copied/copy:opacity-100 group-data-copied/copy:blur-none"
      />
      <span aria-live="polite" className="sr-only">
        {copied ? m.copied() : ""}
      </span>
    </button>
  );
}

export const CodeBlock = { Root, Command, Snippet, Copy };
