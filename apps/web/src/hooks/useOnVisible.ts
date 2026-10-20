import { useEffect, useRef } from "react";

export function useOnVisible(onVisible: () => void, enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) onVisible();
      },
      { rootMargin: "400px" }
    );
    observer.observe(element);

    return () => observer.disconnect();
  }, [onVisible, enabled]);

  return ref;
}