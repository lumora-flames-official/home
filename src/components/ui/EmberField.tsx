import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { cn } from '../../lib/utils';

/** Props for {@link EmberField}. */
export interface EmberFieldProps {
  /**
   * Number of embers to render. Kept low by default — each one is an independent
   * infinite tween, and past roughly twenty the effect reads as snow rather than
   * firelight.
   */
  count?: number;
  /** Extra classes for the positioning wrapper. */
  className?: string;
  /** Pauses all particle tweens when `true`. Used to freeze off-screen sections. */
  paused?: boolean;
}

/**
 * Deterministic pseudo-random number in `[0, 1)` from a seed.
 *
 * Ember *starting positions* are rendered into markup, so they must be stable
 * across re-renders — `Math.random()` in the render body would reshuffle every
 * ember on any parent state change. Their *motion* is randomised by GSAP
 * instead, where it belongs.
 */
function seeded(seed: number): number {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * EmberField scatters slow-rising sparks across its parent, as though a flame
 * were burning just off-frame.
 *
 * Purely decorative: the wrapper is `aria-hidden` and `pointer-events-none`, so
 * it never intercepts a click or reaches the accessibility tree.
 *
 * Implemented as absolutely-positioned divs driven by GSAP rather than a
 * `<canvas>` and a `requestAnimationFrame` loop. That keeps it inside the house
 * animation rule (all motion is GSAP inside `useGSAP`), lets GSAP's context
 * handle teardown, and animates only `y`/`x`/`opacity`/`scale`, all of which the
 * compositor can run off the main thread.
 *
 * Renders nothing at all when the visitor prefers reduced motion — a static
 * scatter of dots would just be visual noise with no meaning.
 */
export const EmberField: React.FC<EmberFieldProps> = ({
  count = 14,
  className,
  paused = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelinesRef = useRef<gsap.core.Timeline[]>([]);
  const prefersReducedMotion = useReducedMotion();

  useGSAP(
    () => {
      timelinesRef.current = [];
      if (prefersReducedMotion) return;

      const embers = gsap.utils.toArray<HTMLElement>('.ember');

      embers.forEach((ember, index) => {
        /*
         * Each ember gets its own timeline rather than one staggered tween, so
         * every spark drifts at its own speed and they never pulse in unison.
         * `repeatRefresh` re-evaluates the `random()` strings on each cycle, so
         * the drift never settles into a visible loop.
         */
        const tl = gsap
          .timeline({ repeat: -1, repeatRefresh: true, delay: index * 0.55, paused })
          .fromTo(
            ember,
            { y: 0, x: 0, opacity: 0, scale: 0.6 },
            {
              y: 'random(-140, -280)',
              x: 'random(-45, 45)',
              opacity: 'random(0.35, 0.85)',
              scale: 'random(0.85, 1.35)',
              duration: 'random(4, 8)',
              ease: 'sine.out',
            }
          )
          .to(ember, { opacity: 0, duration: 1.6, ease: 'power1.in' }, '-=1.6');

        timelinesRef.current.push(tl);
      });
    },
    { scope: containerRef, dependencies: [prefersReducedMotion, count] }
  );

  useEffect(() => {
    timelinesRef.current.forEach((tl) => (paused ? tl.pause() : tl.resume()));
  }, [paused]);

  if (prefersReducedMotion) return null;

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      {Array.from({ length: count }, (_, index) => {
        // Two independent seeds per ember so horizontal position and size don't
        // correlate into a visible diagonal.
        const leftPct = 6 + seeded(index + 1) * 88;
        const bottomPct = seeded(index + 41) * 45;
        const size = 2 + Math.round(seeded(index + 91) * 3);

        return (
          <span
            key={index}
            className="ember absolute rounded-full bg-amber-400 opacity-0 blur-[1px] dark:bg-amber-300"
            style={{
              left: `${leftPct}%`,
              bottom: `${bottomPct}%`,
              width: `${size}px`,
              height: `${size}px`,
              boxShadow: '0 0 8px rgba(245, 158, 11, 0.9)',
            }}
          />
        );
      })}
    </div>
  );
};
