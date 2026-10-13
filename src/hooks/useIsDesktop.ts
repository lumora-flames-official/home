import { useState, useEffect } from 'react';

const DESKTOP_QUERY = '(min-width: 1024px)';

/**
 * Tracks whether the viewport is at or above the `lg` breakpoint (1024px).
 *
 * Used to gate heavy desktop-only features — pinned ScrollTriggers, EmberField
 * particles, InteractiveCandleCanvas — so mobile never mounts them at all
 * rather than mounting and CSS-hiding.
 */
export function useIsDesktop(): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia(DESKTOP_QUERY).matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_QUERY);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, []);

  return matches;
}
