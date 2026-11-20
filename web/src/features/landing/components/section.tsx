import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

function Root({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "mx-auto w-full max-w-6xl px-5 py-14 sm:px-8 sm:py-28",
        className,
      )}
      {...props}
    />
  );
}

function Header({ className, ...props }: ComponentProps<"div">) {
  return (
    <Reveal
      className={cn("max-w-2xl space-y-3 sm:space-y-4", className)}
      {...props}
    />
  );
}

function Eyebrow({ className, children, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "flex items-center gap-2 font-mono text-xs tracking-wide text-muted-foreground uppercase",
        className,
      )}
      {...props}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-brand" />
      {children}
    </p>
  );
}

function Title({ className, ...props }: ComponentProps<"h2">) {
  return (
    <h2
      className={cn(
        "font-display text-[2.125rem] leading-[1.05] tracking-tight text-balance sm:text-5xl",
        className,
      )}
      {...props}
    />
  );
}

function Lead({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg",
        className,
      )}
      {...props}
    />
  );
}

export const Section = { Root, Header, Eyebrow, Title, Lead };
