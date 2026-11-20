import { useEffect, useState } from "react";

/**
 * Counts from 0 to `delays.length`, waiting `delays[step]` ms before each
 * step, while `active`. With reduced motion it jumps to the end: the content
 * is what matters, not watching it arrive.
 */
export function useSequence(delays: readonly number[], active: boolean) {
  const [step, setStep] = useState(0);
  const done = step >= delays.length;

  useEffect(() => {
    if (!active || done) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStep(delays.length);
      return;
    }
    const timer = window.setTimeout(
      () => setStep((current) => current + 1),
      delays[step],
    );
    return () => window.clearTimeout(timer);
  }, [active, done, delays, step]);

  return step;
}
