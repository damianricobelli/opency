import type { ComponentProps, CSSProperties } from "react";

// One observer for every revealed block on the page.
let observer: IntersectionObserver | undefined;

function reveal(element: HTMLElement | null) {
  if (!element) return;
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute("data-visible", "");
        observer?.unobserve(entry.target);
      }
    },
    // A little before the block is centered, and only once.
    { rootMargin: "0px 0px -12% 0px" },
  );
  observer.observe(element);
  return () => observer?.unobserve(element);
}

/**
 * Rises into place the first time it scrolls into view (`[data-reveal]` in
 * `styles.css`). `delay` staggers siblings: keep it under ~80ms per item.
 */
export function Reveal({
  delay = 0,
  style,
  ...props
}: ComponentProps<"div"> & { delay?: number }) {
  return (
    <div
      ref={reveal}
      data-reveal
      style={{ "--reveal-delay": `${delay}ms`, ...style } as CSSProperties}
      {...props}
    />
  );
}
