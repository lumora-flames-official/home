import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Flame, Pause, Play } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import type { PromoSlide } from '../../types/promotion';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { cn } from '../../lib/utils';
import { DESIGN_TOKENS } from '../../theme/designSystem';
import { EASE } from '../../lib/animations';
import { ResponsiveImage } from '../../components/ui/ResponsiveImage';

/** Props for {@link PromotionalCarouselTemplate1}. */
export interface PromotionalCarouselTemplate1Props {
  /** Slides to render, in order. Renders nothing when empty. */
  slides: PromoSlide[];
  /** Fired with `targetCollectionId` when a slide's CTA is activated. */
  onNavigateCollection: (collectionId: string) => void;
  /** Milliseconds each slide holds before advancing. */
  autoSlideInterval?: number;
  /**
   * Accessible name for the carousel region. Set it per placement — several
   * carousels share this template on one page, and identical labels leave a
   * screen-reader user unable to tell them apart in a landmark list.
   */
  label?: string;
}

/**
 * PromotionalCarouselTemplate1 is the editorial full-bleed promo carousel: one
 * photograph per slide with layered copy over a bottom scrim.
 *
 * ## Autoplay
 *
 * Advances every {@link PromotionalCarouselTemplate1Props.autoSlideInterval} ms,
 * and pauses whenever the visitor is engaging with it — pointer over the frame,
 * keyboard focus inside it, or the tab hidden — so copy is never yanked away
 * mid-sentence. A visible toggle also stops it outright, which is what WCAG 2.2.2
 * requires of any moving content that runs longer than five seconds. Autoplay is
 * off from the start when the visitor prefers reduced motion; the dots and the
 * toggle still work, so nothing becomes unreachable.
 *
 * All transitions are GSAP inside `useGSAP`, scoped to the frame.
 */
export const PromotionalCarouselTemplate1: React.FC<PromotionalCarouselTemplate1Props> = ({
  slides,
  onNavigateCollection,
  autoSlideInterval = 7000,
  label = 'Featured promotions',
}) => {
  const [activeIdx, setActiveIdx] = useState(0);
  /** Visitor's explicit play/pause choice, via the toggle. */
  const [isPlaying, setIsPlaying] = useState(true);
  /** Transient pause from hover or focus — separate so it can't overwrite the above. */
  const [isEngaged, setIsEngaged] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const total = slides.length;
  const slide = slides[activeIdx] ?? slides[0];

  /*
   * Reduced motion means no self-advancing slideshow at all — the visitor drives
   * it. Derived rather than stored so a mid-session preference change is picked up.
   */
  const isAutoplayActive = isPlaying && !isEngaged && !prefersReducedMotion && total > 1;

  /** Clamps `activeIdx` if the slide list shrinks under it. */
  if (total > 0 && activeIdx >= total) setActiveIdx(0);

  const goTo = useCallback((index: number) => setActiveIdx(index), []);

  // Slide entrance: photograph settles out of a blurred overscale, copy follows.
  useGSAP(
    () => {
      if (!slide) return;

      if (prefersReducedMotion) {
        // Clear anything a previous tween left behind, then show it plainly.
        gsap.set(['.carousel-bg', '.carousel-eyebrow', '.carousel-title', '.carousel-desc'], {
          clearProps: 'all',
        });
        return;
      }

      const tl = gsap.timeline();

      tl.fromTo(
        '.carousel-bg',
        { scale: 1.15, filter: 'blur(10px)' },
        { scale: 1, filter: 'blur(0px)', duration: 1.2, ease: EASE.enter }
      )
        .fromTo(
          '.carousel-eyebrow',
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6 },
          '-=0.8'
        )
        .fromTo(
          '.carousel-title',
          { y: 40, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, ease: EASE.enter },
          '-=0.5'
        )
        .fromTo(
          '.carousel-desc',
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6 },
          '-=0.4'
        );
    },
    { scope: containerRef, dependencies: [activeIdx, slides, prefersReducedMotion] }
  );

  // Autoplay timer. Re-created whenever the active slide changes, so manually
  // picking a dot restarts the full dwell rather than cutting it short.
  useEffect(() => {
    if (!isAutoplayActive) return;

    const timer = window.setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % total);
    }, autoSlideInterval);

    return () => window.clearInterval(timer);
  }, [isAutoplayActive, total, autoSlideInterval, activeIdx]);

  // Don't burn cycles advancing slides nobody can see.
  useEffect(() => {
    const onVisibilityChange = () => setIsEngaged(document.hidden);

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  /*
   * Warm the next slide's photograph.
   *
   * Only the active slide's `<img>` is mounted (it is re-keyed on change), which
   * keeps the initial cost to one image — but it also means advancing starts a
   * fetch from cold, and these are multi-megabyte PNGs. Decoding the next one
   * during the current slide's dwell means the transition has something to show.
   * Deliberately one ahead, not all of them.
   */
  useEffect(() => {
    if (total < 2) return;

    const next = slides[(activeIdx + 1) % total];
    if (!next) return;

    const preloader = new Image();
    /*
     * The plain fallback `src`, not a `srcset`. `Image` can take `srcset` + `sizes`, but
     * this element is never laid out, so `sizes` has no viewport to resolve against and
     * the browser would pick a variant on its own terms. Warming the fallback guarantees
     * *something* is decoded; if the picked variant differs it is a cache miss, not a
     * broken slide.
     */
    preloader.src = next.bgImage.img.src;
  }, [activeIdx, slides, total]);

  if (!slide) return null;

  return (
    <section
      ref={containerRef}
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={() => setIsEngaged(true)}
      onMouseLeave={() => setIsEngaged(false)}
      // `focus`/`blur` don't bubble; the capturing `-in`/`-out` pair does, so
      // tabbing to the CTA inside the frame pauses it too.
      onFocus={() => setIsEngaged(true)}
      onBlur={() => setIsEngaged(false)}
      className={cn(
        'relative flex h-[75vh] w-full items-end overflow-hidden rounded-[2rem] border border-stone-200/50 shadow-2xl sm:h-[85vh] sm:rounded-[2.5rem] dark:border-stone-800/50',
        DESIGN_TOKENS.layout.paddingX,
        'py-10 sm:py-16'
      )}
    >
      {/* Full-bleed within the carousel frame, which spans the page. */}
      <ResponsiveImage
        key={slide.id}
        picture={slide.bgImage}
        alt={`${slide.title} ${slide.highlightText}`}
        sizes="100vw"
        /* The first slide is near the top of the page, so its paint shouldn't
           wait on the lazy-load heuristic. Later slides mount only once they're
           active, by which point the effect above has already warmed them. */
        eager={activeIdx === 0}
        className="carousel-bg absolute inset-0 h-full w-full object-cover"
      />

      <div className={cn('absolute inset-0', DESIGN_TOKENS.overlay.scrimBottom)} />

      <div className="relative z-10 max-w-3xl space-y-5 sm:space-y-6">
        {/*
          Announce slide changes politely. The region wraps only the copy, so a
          screen reader gets the new slide's text without the controls being
          re-read on every advance.
        */}
        <div aria-live="polite" aria-atomic="true" className="space-y-5 sm:space-y-6">
          <span className="carousel-eyebrow inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/20 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-amber-300 backdrop-blur-md">
            <Flame className="h-3.5 w-3.5 text-amber-400" /> {slide.tagline}
          </span>

          <h2 className="carousel-title text-3xl font-light leading-tight tracking-tight text-white sm:text-6xl lg:text-7xl">
            {slide.title}{' '}
            <span className="font-semibold italic text-amber-400">{slide.highlightText}</span>
          </h2>

          <p className="carousel-desc max-w-xl text-sm font-light leading-relaxed text-stone-300 sm:text-lg">
            {slide.description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 pt-2">
          <button
            type="button"
            onClick={() => onNavigateCollection(slide.targetCollectionId)}
            className={cn(
              'flex items-center gap-3 rounded-full bg-amber-500 px-6 py-4 text-stone-950 shadow-lg transition-all duration-300 hover:bg-amber-400 active:scale-95 sm:px-8',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950',
              DESIGN_TOKENS.typography.button
            )}
          >
            <span>{slide.ctaText}</span>
            <ArrowRight className="h-4 w-4 shrink-0" />
          </button>

          {total > 1 && (
            <div className="flex items-center gap-1">
              {/* Dots. Each is a 44x44 hit area around a 2px-tall visual bar. */}
              {slides.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goTo(idx)}
                  aria-label={`Show slide ${idx + 1} of ${total}: ${s.title} ${s.highlightText}`}
                  aria-current={idx === activeIdx}
                  className="group inline-flex h-11 w-8 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'h-2 rounded-full transition-all duration-500',
                      idx === activeIdx
                        ? 'w-8 bg-amber-400'
                        : 'w-2 bg-white/40 group-hover:bg-white/70'
                    )}
                  />
                </button>
              ))}

              {/*
                WCAG 2.2.2: any auto-advancing content needs a mechanism to stop
                it. Hidden when reduced motion already keeps autoplay off.
              */}
              {!prefersReducedMotion && (
                <button
                  type="button"
                  onClick={() => setIsPlaying((prev) => !prev)}
                  aria-label={
                    isPlaying ? 'Pause automatic slideshow' : 'Resume automatic slideshow'
                  }
                  title={isPlaying ? 'Pause slideshow' : 'Play slideshow'}
                  className="ml-1 inline-flex h-11 w-11 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
