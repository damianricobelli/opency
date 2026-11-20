import { useEffect, useRef, useState } from "react";

/** Whether the element is on screen; with `once`, stays true after the first time. */
export function useInView<T extends Element>({
  once = false,
  rootMargin = "0px",
}: {
  once?: boolean;
  rootMargin?: string;
} = {}) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        setInView(entry.isIntersecting);
        if (entry.isIntersecting && once) observer.disconnect();
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [once, rootMargin]);

  return [ref, inView] as const;
}
