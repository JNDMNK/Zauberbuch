import { useEffect, useRef } from 'react';

/** Ruft onIntersect auf, sobald das Sentinel-Element in den sichtbaren Bereich kommt. */
export function useInfiniteScroll(onIntersect: () => void, enabled: boolean, resetKey: unknown = null) {
  const ref = useRef<HTMLDivElement | null>(null);
  const cb = useRef(onIntersect);
  cb.current = onIntersect;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) cb.current();
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
    // resetKey: Beobachter neu anlegen, damit ein weiterhin sichtbares Sentinel erneut auslöst
  }, [enabled, resetKey]);

  return ref;
}
