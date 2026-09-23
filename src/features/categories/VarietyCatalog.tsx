import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CatalogProduct } from '../../types/catalog';
import type { ProductActionContext } from '../../lib/productActions';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { DURATION, EASE, STAGGER, settleInstantly } from '../../lib/animations';
import { cn } from '../../lib/utils';
import { ProductCard } from './ProductCard';

gsap.registerPlugin(ScrollTrigger);

/** Props for {@link VarietyCatalog}. */
export interface VarietyCatalogProps {
  /**
   * Products to show, already selected by the caller.
   *
   * Passed in rather than looked up from ids, which is what this component used to do.
   * `/catalog` filters by a search query, so it has to decide which products exist
   * *before* rendering — a component that fetched its own data could only be told which
   * variety to show, never which subset of it, and the page would have had to duplicate
   * the same lookup to know whether the rail would end up empty.
   */
  products: readonly CatalogProduct[];
  /** Display titles used in each card's enquiry message. */
  context: ProductActionContext;
  /** Rendered as the rail's heading. */
  heading: string;
  /** Ties the heading to the section for assistive technology. */
  headingId: string;
  /**
   * `'rail'` (default) is the horizontal scroll-snap track; `'grid'` wraps into rows.
   *
   * The catalog page uses `'grid'` because it renders one collection at a time and so
   * has the full page width to spend — a rail there would hide products behind a
   * horizontal gesture for no reason, when the whole point of paginating by collection
   * was to give each list room. The rail remains correct where a variety is one band
   * inside a longer vertical narrative, which is what it was built for.
   */
  layout?: 'rail' | 'grid';
}

/**
 * The candles listed under one variety, as a horizontal rail or a wrapping grid.
 *
 * Purely presentational: it renders the products it is given. Returns `null` for an
 * empty list so a caller can hand it a filtered set without first checking whether
 * anything survived the filter.
 *
 * ## Why native scroll-snap and not GSAP Draggable
 *
 * `Draggable` + `InertiaPlugin` are ~117 KB of source and, per `CLAUDE.md`, took
 * the landing chunk from 22 KB to 88 KB the last time they were statically
 * imported. A CSS `snap-x snap-mandatory` overflow container costs nothing, and
 * gets touch momentum, trackpad gestures, keyboard arrow keys and a focus ring
 * from the platform rather than from re-implementation. The arrow buttons exist
 * for mouse users, who are the only ones the native affordance doesn't serve.
 *
 * GSAP is therefore used for exactly one thing here — the cards' entrance — and
 * that is skipped under reduced motion.
 */
export const VarietyCatalog: React.FC<VarietyCatalogProps> = ({
  products,
  context,
  heading,
  headingId,
  layout = 'rail',
}) => {
  const isRail = layout === 'rail';
  const railRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  /**
   * Whether either arrow can still move the rail. Held as state because the
   * buttons' disabled attribute depends on it, and updated only on an actual
   * change — a scroll handler that calls `setState` every frame re-renders the
   * whole rail continuously, the same trap the collections journey documents.
   */
  const [overflow, setOverflow] = useState({ start: false, end: false });

  useGSAP(
    () => {
      const cards = trackRef.current?.children;
      if (!cards || cards.length === 0) return;

      if (prefersReducedMotion) {
        // Nothing has run yet, but clear anyway: a props change can rebuild this
        // callback after a tween already applied a transform, which would
        // otherwise leave the rail stranded mid-reveal and possibly invisible.
        settleInstantly(cards);
        return;
      }

      gsap.fromTo(
        cards,
        { y: 32, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: DURATION.base,
          stagger: STAGGER,
          ease: EASE.enter,
          scrollTrigger: {
            trigger: railRef.current,
            // Rails sit below a pinned stage, so they are scrolled *into* view;
            // firing a little before the top edge means the reveal has finished
            // by the time the row is actually being read.
            start: 'top 85%',
            once: true,
          },
        }
      );
    },
    {
      scope: railRef,
      dependencies: [headingId, products.length, prefersReducedMotion],
    }
  );

  /**
   * Recomputes which arrows are live.
   *
   * Both comparisons need a tolerance, for different reasons:
   *
   * - At the far end, a fully scrolled container reports a `scrollLeft` a fraction
   *   short of the maximum, which would leave the forward arrow enabled with
   *   nowhere to go. Hence the trailing `- 1`.
   * - At the near end, the resting `scrollLeft` is **not zero**. The track carries
   *   horizontal padding so a focused card's ring isn't clipped by the overflow,
   *   and `snap-start` aligns the first card inside that padding — measured at 4px
   *   with `px-1`. Comparing against `0` therefore reported "already scrolled" the
   *   moment the rail rendered, and the back arrow appeared enabled while clicking
   *   it did nothing. Reading the padding rather than hardcoding 4 keeps the two in
   *   step if that class ever changes.
   */
  const syncOverflow = (): void => {
    const track = trackRef.current;
    if (!track) return;

    const restingLeft = parseFloat(getComputedStyle(track).paddingLeft) || 0;

    const next = {
      start: track.scrollLeft > restingLeft + 1,
      end: track.scrollLeft < track.scrollWidth - track.clientWidth - 1,
    };

    setOverflow((current) =>
      current.start === next.start && current.end === next.end ? current : next
    );
  };

  /**
   * Seeds the arrow state and keeps it right as the rail's metrics change.
   *
   * `onScroll` alone is not enough, and fails in a way that looks like a bug in the
   * buttons: on mount nothing has scrolled, so `end` would stay `false` and the
   * forward arrow would render disabled with no way to ever enable it.
   *
   * A `ResizeObserver` rather than a `window` resize listener because three
   * different things change these numbers — the viewport resizing, the cards
   * changing width at a breakpoint, and a product photo finishing loading and
   * growing `scrollWidth`. Only the observer sees all three.
   */
  useEffect(() => {
    const track = trackRef.current;
    // A grid has no horizontal overflow and no arrows to keep in sync, so there is
    // nothing for the observer to watch.
    if (!track || !isRail) return;

    const observer = new ResizeObserver(syncOverflow);
    observer.observe(track);
    // Cards are the elements whose width actually changes at a breakpoint.
    for (const card of track.children) observer.observe(card);

    return () => observer.disconnect();
  }, [products.length, isRail]);

  /**
   * Scrolls by one card.
   *
   * Derives the step from the first card's actual width rather than a constant, so
   * it stays correct across the card's responsive widths without the two needing
   * to be kept in sync.
   */
  const nudge = (direction: -1 | 1): void => {
    const track = trackRef.current;
    const firstCard = track?.firstElementChild;
    if (!track || !firstCard) return;

    track.scrollBy({
      left: direction * (firstCard.clientWidth + 16),
      // Smooth scrolling is motion too — honour the same preference the reveal does.
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  };

  // Nothing to show. Returning null rather than an empty-state row is what lets the
  // catalog page pass a search-filtered list straight through without pre-checking it.
  if (products.length === 0) return null;

  const arrowClasses =
    'grid h-9 w-9 place-items-center rounded-full border border-stone-300 text-stone-700 transition-colors hover:border-amber-500 hover:text-amber-600 disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:text-amber-400 dark:focus-visible:ring-offset-stone-950';

  return (
    <section ref={railRef} aria-labelledby={headingId} className="space-y-5">
      <div className="flex items-end justify-between gap-6">
        <div className="space-y-1.5">
          <h3
            id={headingId}
            className="text-2xl font-light tracking-tight text-stone-900 sm:text-3xl dark:text-stone-100"
          >
            {heading}
          </h3>
          <p className="text-xs font-light tabular-nums text-stone-500 dark:text-stone-400">
            {products.length} {products.length === 1 ? 'piece' : 'pieces'}
          </p>
        </div>

        {/* Redundant for touch and trackpad, which scroll the rail directly, so it
            is hidden from assistive tech rather than duplicating the card list as
            two more tab stops per rail. */}
        <div className={cn('hidden shrink-0 gap-2', isRail && 'sm:flex')} aria-hidden="true">
          <button
            type="button"
            tabIndex={-1}
            onClick={() => nudge(-1)}
            disabled={!overflow.start}
            className={arrowClasses}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => nudge(1)}
            disabled={!overflow.end}
            className={arrowClasses}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        onScroll={isRail ? syncOverflow : undefined}
        className={cn(
          isRail
            ? /* `[scrollbar-width:none]` hides the bar without hiding the overflow — the
                 rail must stay scrollable, so `overflow-hidden` is not an option. The
                 `-mx-1`/`px-1` pair keeps a focused card's ring from being clipped. */
              '-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
            : 'grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
        )}
      >
        {products.map((product, index) => (
          <ProductCard
            key={product.sku}
            product={product}
            context={context}
            layout={layout}
            /* Eagerly load only what is plausibly above the fold: one card in a rail,
               a first grid row's worth otherwise. */
            eager={index < (isRail ? 1 : 4)}
          />
        ))}
      </div>
    </section>
  );
};
