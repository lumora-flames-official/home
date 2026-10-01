import React, { useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ArrowUpRight, Gift } from 'lucide-react';
import type { GiftingSlide } from '../../types/promotion';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { cn } from '../../lib/utils';
import { DESIGN_TOKENS } from '../../theme/designSystem';
import { EASE, DURATION, settleInstantly } from '../../lib/animations';
import { ResponsiveImage } from '../../components/ui/ResponsiveImage';

/**
 * Loads and registers Draggable + InertiaPlugin on demand.
 *
 * Both ship with the standard GSAP package as of 3.13 (formerly Club-only), so
 * there's no extra dependency — but together they are ~117 KB of source, and
 * statically importing them put all of it on the landing page's critical path
 * for a drag affordance on the *fifth* screen. Imported dynamically, they arrive
 * in their own chunk after first paint.
 *
 * The drift, the hover pause, and the click-through all work without them; drag
 * simply becomes available a moment later.
 *
 * @returns The Draggable class, or `null` if the chunk fails to load.
 */
async function loadDraggable(): Promise<typeof import('gsap/Draggable').Draggable | null> {
  try {
    const [{ Draggable }, { InertiaPlugin }] = await Promise.all([
      import('gsap/Draggable'),
      import('gsap/InertiaPlugin'),
    ]);

    gsap.registerPlugin(Draggable, InertiaPlugin);
    return Draggable;
  } catch {
    // A failed chunk load must not break the ribbon — it just won't drag.
    return null;
  }
}

/** Props for {@link PromoCarouselTemplate3}. */
export interface PromoCarouselTemplate3Props {
  /** Occasions to render, in order. Renders nothing when empty. */
  slides: GiftingSlide[];
  /** Fired with `targetCollectionId` when a card is activated. */
  onNavigateCollection: (collectionId: string) => void;
  /**
   * Seconds for one full pass of the ribbon. Higher is slower; the default is
   * deliberately unhurried so cards stay readable while moving.
   */
  driftDuration?: number;
  /** Accessible name for the region. */
  label?: string;
}

/**
 * PromoCarouselTemplate3 is the gifting ribbon: a continuously drifting row of
 * tall portrait cards, each an *occasion* rather than a product.
 *
 * ## Why a ribbon
 *
 * Unlike the other two placements this shows several options at once, because
 * gifting is a browsing task — the visitor doesn't know which collection they
 * want yet, so hiding three of four options behind a timer works against them.
 * Each card routes to the collection that serves its occasion.
 *
 * ## The drift
 *
 * Slides are rendered twice and the track is translated by exactly `-50%`, so the
 * second copy occupies the first's position at the end of the cycle and the loop
 * is seamless. The duplicate set is `aria-hidden` and removed from the tab order
 * with `tabIndex={-1}`, so assistive tech and keyboard users see each occasion
 * once, not twice.
 *
 * Drift pauses on hover and on keyboard focus anywhere inside the ribbon —
 * `onFocus`/`onBlur` in React bubble (unlike the native events), so focusing a
 * card deep inside pauses the whole track. It also pauses when the tab is hidden.
 *
 * ## Reduced motion
 *
 * No drift, no duplicate set. The track becomes a native horizontally scrollable
 * strip with scroll snapping — still fully explorable, by touch, trackpad, or
 * keyboard, with no motion the visitor didn't ask for.
 */
export const PromoCarouselTemplate3: React.FC<PromoCarouselTemplate3Props> = ({
  slides,
  onNavigateCollection,
  driftDuration = 42,
  label = 'Gifting occasions',
}) => {
  const rootRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const driftRef = useRef<gsap.core.Tween | null>(null);
  const prefersReducedMotion = useReducedMotion();

  /** Pointer over or focus inside the ribbon — pauses the drift. */
  const [isEngaged, setIsEngaged] = useState(false);
  /**
   * Mirrors `isEngaged` for the drag callbacks. They run outside React's render
   * cycle, and a released drag must not resume the drift while the pointer is
   * still hovering — reading state there would see a stale value.
   */
  const isEngagedRef = useRef(false);

  const total = slides.length;

  /** Updates engagement in both state (for render) and ref (for GSAP callbacks). */
  const setEngaged = (next: boolean) => {
    isEngagedRef.current = next;
    setIsEngaged(next);
  };

  // The drift itself. Built once, then played/paused by the effect below rather
  // than being rebuilt on every engagement change.
  useGSAP(
    () => {
      if (prefersReducedMotion || total === 0) {
        settleInstantly(trackRef.current);
        driftRef.current = null;
        return;
      }

      driftRef.current = gsap.to(trackRef.current, {
        // The track holds two identical sets, so -50% lands the second set
        // exactly where the first began. `xPercent` keeps this a transform.
        xPercent: -50,
        duration: driftDuration,
        repeat: -1,
        ease: 'none',
      });

      // Cards settle in on mount, independent of the drift.
      gsap.fromTo(
        '.ribbon-card',
        { y: 34, opacity: 0 },
        { y: 0, opacity: 1, duration: DURATION.base, stagger: 0.08, ease: EASE.enter }
      );

      /*
       * Drag-to-scrub, attached once its chunk arrives.
       *
       * Draggable and the drift both write to the track's transform, so the
       * drift pauses for the whole gesture — including the inertia glide, via
       * `onThrowComplete` rather than `onDragEnd` — and resumes only if the
       * pointer has actually left. Without that, throwing the ribbon and then
       * moving away would leave it stopped for good.
       *
       * `dragClickables: false` keeps cards clickable: Draggable tells a tap from
       * a drag, so tapping navigates and dragging scrubs.
       */
      let draggable: import('gsap/Draggable').Draggable | undefined;
      /* Guards the async gap: this callback can be torn down and re-run (theme
         change, resize, StrictMode) before the import resolves, and a Draggable
         created after that would never be killed. */
      let cancelled = false;

      void loadDraggable().then((Draggable) => {
        if (cancelled || !Draggable || !trackRef.current) return;

        [draggable] = Draggable.create(trackRef.current, {
          type: 'x',
          inertia: true,
          dragClickables: false,
          cursor: 'grab',
          activeCursor: 'grabbing',
          onPressInit: () => driftRef.current?.pause(),
          onThrowComplete: () => {
            if (!isEngagedRef.current) driftRef.current?.resume();
          },
        });
      });

      return () => {
        cancelled = true;
        draggable?.kill();
        driftRef.current = null;
      };
    },
    { scope: rootRef, dependencies: [prefersReducedMotion, total, driftDuration] }
  );

  // Pause/resume. Reading the tween from a ref keeps this out of the timeline
  // build, so engaging the ribbon never restarts the drift from the beginning.
  useGSAP(
    () => {
      const drift = driftRef.current;
      if (!drift) return;

      if (isEngaged) drift.pause();
      else drift.resume();
    },
    { dependencies: [isEngaged, prefersReducedMotion, total] }
  );

  // Don't drift for a tab nobody is looking at.
  React.useEffect(() => {
    const onVisibilityChange = () => {
      isEngagedRef.current = document.hidden;
      setIsEngaged(document.hidden);
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  if (total === 0) return null;

  /**
   * One occasion card.
   *
   * @param slide The occasion to render.
   * @param isClone True for the duplicated set that makes the loop seamless —
   *   hidden from assistive tech and skipped in the tab order.
   */
  const renderCard = (slide: GiftingSlide, isClone: boolean) => (
    <button
      key={`${slide.id}${isClone ? '-clone' : ''}`}
      type="button"
      onClick={() => onNavigateCollection(slide.targetCollectionId)}
      aria-hidden={isClone || undefined}
      tabIndex={isClone ? -1 : undefined}
      className={cn(
        'ribbon-card group relative w-[78vw] shrink-0 overflow-hidden rounded-[2rem] text-left sm:w-[22rem] lg:w-[24rem]',
        'aspect-[3/4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-50 dark:focus-visible:ring-offset-stone-950',
        // Reduced motion turns the track into a scroller, so cards snap.
        prefersReducedMotion && 'snap-start'
      )}
    >
      {/* `sizes` mirrors the card widths on the class above — 78vw on a phone, then a
          fixed 22rem/24rem. The biggest win on the page: these cards never exceed 384px,
          so every one of them drops from the 1344px variant to the 640px one. */}
      <ResponsiveImage
        picture={slide.image}
        /* Decorative: the card's own heading and body carry the meaning, so an
           alt here would just be read twice. */
        alt=""
        sizes="(min-width: 1024px) 24rem, (min-width: 640px) 22rem, 78vw"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
      />

      <div className={cn('absolute inset-0', DESIGN_TOKENS.overlay.scrimBottom)} />

      <div className="relative flex h-full flex-col justify-end gap-3 p-7">
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
          <Gift className="h-3.5 w-3.5" aria-hidden="true" />
          {slide.occasion}
        </span>

        <h3 className="text-2xl font-light leading-tight tracking-tight text-white sm:text-3xl">
          {slide.title}
        </h3>

        <p className="text-sm font-light leading-relaxed text-stone-300">{slide.body}</p>

        <span
          className={cn(
            'mt-1 inline-flex items-center gap-2 text-amber-300 transition-colors group-hover:text-amber-200',
            DESIGN_TOKENS.typography.button
          )}
        >
          Explore
          <ArrowUpRight
            className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
      </div>
    </button>
  );

  return (
    <section
      ref={rootRef}
      aria-label={label}
      aria-roledescription="carousel"
      onMouseEnter={() => setEngaged(true)}
      onMouseLeave={() => setEngaged(false)}
      // React's onFocus/onBlur bubble, so focus on any card pauses the ribbon.
      onFocus={() => setEngaged(true)}
      onBlur={() => setEngaged(false)}
      className="w-full space-y-10 overflow-hidden py-4"
    >
      <div className={cn(DESIGN_TOKENS.layout.contained, 'max-w-3xl space-y-4')}>
        <span className={DESIGN_TOKENS.typography.eyebrow}>Gifting</span>
        <h2 className={DESIGN_TOKENS.typography.sectionTitle}>
          <span className="text-stone-900 dark:text-stone-100">Chosen for the</span>{' '}
          <span className="font-semibold text-amber-500">occasion</span>
        </h2>
        <p className={cn(DESIGN_TOKENS.typography.body, 'text-stone-600 dark:text-stone-400')}>
          Tell us the moment and we will point you at the right pour.
        </p>
      </div>

      <div
        ref={trackRef}
        className={cn(
          'flex w-max gap-5 px-6 sm:px-10 lg:px-16',
          // Reduced motion: a real scroller instead of a tweened track.
          prefersReducedMotion && 'w-full snap-x snap-mandatory overflow-x-auto pb-4'
        )}
      >
        {slides.map((slide) => renderCard(slide, false))}
        {/* Duplicate set exists only so the -50% loop is seamless. Skipped by
            screen readers and by Tab, and not rendered at all when the track is
            a native scroller. */}
        {!prefersReducedMotion && slides.map((slide) => renderCard(slide, true))}
      </div>
    </section>
  );
};
