import {
  Component,
  type CSSProperties,
  lazy,
  type ReactNode,
  Suspense,
  useEffect,
  useState,
} from "react";
import { useThemeMode } from "@/hooks/use-theme-mode";
import { cn } from "@/lib/utils";
import { useInView } from "../lib/use-in-view";

// three.js stays out of the entry chunk: it loads when the browser is idle.
const HeroScene = lazy(() => import("./hero-scene"));

/** If WebGL or the chunk fails, the static slides simply stay. */
class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

const OFFSETS = [-2, -1, 0, 1, 2] as const;

/**
 * The same fan, drawn with CSS: what the server sends, what reduced motion
 * keeps, and what stays if WebGL is missing.
 */
function StaticSlides({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "absolute inset-0 grid place-items-center [--fan-step:44%] [perspective:1200px] sm:[--fan-step:66%]",
        className,
      )}
    >
      {OFFSETS.map((offset) => {
        const distance = Math.abs(offset);
        return (
          <div
            key={offset}
            style={
              {
                "--offset": offset,
                transform: `translateX(calc(var(--offset) * var(--fan-step))) translateZ(${-distance * 70}px) rotateY(${-offset * 15}deg)`,
                zIndex: 3 - distance,
              } as CSSProperties
            }
            className={cn(
              // The shadow keeps paper slides apart from a paper page in the light theme.
              "col-start-1 row-start-1 flex aspect-[4/5] h-[62%] flex-col justify-between rounded-[5%] border border-input p-[7%] shadow-[0_10px_28px_-14px_color-mix(in_oklch,var(--foreground)_40%,transparent)]",
              offset === 0
                ? "border-transparent bg-foreground text-background"
                : "bg-card text-foreground",
            )}
          >
            <span className="flex items-center gap-[6%]">
              <span className="size-[5%] min-w-1.5 rounded-full bg-brand aspect-square" />
              <span className="h-[3px] w-1/4 rounded-full bg-current opacity-35" />
            </span>
            <span className="grid gap-[9%]">
              <span className="h-2 w-[85%] rounded-full bg-current sm:h-3" />
              <span className="h-2 w-[65%] rounded-full bg-current sm:h-3" />
              <span
                className={cn(
                  "h-2 w-2/5 rounded-full sm:h-3",
                  offset === 0 ? "bg-brand" : "bg-current",
                )}
              />
            </span>
            <span className="h-[7%] w-[6%] min-w-1.5 rounded-[2px] bg-current opacity-90" />
          </div>
        );
      })}
    </div>
  );
}

export function HeroStage({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  const [stage, inView] = useInView<HTMLDivElement>({ rootMargin: "80px" });
  const [live, setLive] = useState(false);
  const [ready, setReady] = useState(false);
  // The slides are painted with the active theme's tokens.
  const { resolvedTheme } = useThemeMode();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!supportsWebGL()) return;
    // After hydration and whatever the browser still has queued.
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(() => setLive(true), {
        timeout: 1500,
      });
      return () => window.cancelIdleCallback(id);
    }
    const timer = setTimeout(() => setLive(true), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      ref={stage}
      role="img"
      aria-label={label}
      className={cn(
        "relative h-52 w-full sm:h-[clamp(15rem,40vw,27rem)]",
        className,
      )}
    >
      <StaticSlides
        className={cn(
          "transition-opacity duration-300 ease-out",
          ready && "opacity-0",
        )}
      />
      {live ? (
        <div
          className={cn(
            "absolute inset-0 opacity-0 transition-opacity duration-500 ease-out",
            ready && "opacity-100",
          )}
        >
          <SceneBoundary>
            <Suspense fallback={null}>
              <HeroScene
                running={inView}
                scheme={resolvedTheme}
                onReady={() => setReady(true)}
              />
            </Suspense>
          </SceneBoundary>
        </div>
      ) : null}
    </div>
  );
}
