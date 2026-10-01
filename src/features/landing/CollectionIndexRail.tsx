import React, { useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { ArrowUpRight } from 'lucide-react';
import { CANDLE_CATEGORIES } from '../../data/categories';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { cn } from '../../lib/utils';
import { DESIGN_TOKENS } from '../../theme/designSystem';
import { EASE, DURATION, settleInstantly } from '../../lib/animations';
import { ResponsiveImage } from '../../components/ui/ResponsiveImage';

gsap.registerPlugin(ScrollTrigger);

/** Props for {@link CollectionIndexRail}. */
export interface CollectionIndexRailProps {
  /** Invoked with a collection id when a row is activated. */
  onSelectCategory: (categoryId: string) => void;
  /** Invoked when the "full story" link is activated — routes to `/collections`. */
  onOpenStory: () => void;
}

/**
 * CollectionIndexRail lists every collection as a row of oversized type, with the
 * hovered or focused row's photograph revealed in a single frame alongside.
 *
 * ## Why not a grid
 *
 * All six collections need an honest way in, but repeating a photo card six times
 * is exactly the catalogue look the brand avoids. Here the *type* is the
 * interface and imagery is secondary — the list reads as a contents page.
 *
 * ## One image, not six
 *
 * The preview frame holds a single `<img>` whose `src` swaps on hover or focus,
 * rather than six images stacked and cross-faded. Six mounted images below the
 * fold means six network requests for multi-megabyte photographs to show one at
 * a time; this makes exactly one request per collection the visitor actually
 * points at. The frame is `aria-hidden` — every row already names its collection
 * in text, so the image carries no information a screen reader needs.
 *
 * Hover *and* focus both drive the preview, so keyboard navigation gets the same
 * experience as a mouse rather than a degraded one.
 */
export const CollectionIndexRail: React.FC<CollectionIndexRailProps> = ({
  onSelectCategory,
  onOpenStory,
}) => {
  const rootRef = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLImageElement>(null);
  const prefersReducedMotion = useReducedMotion();

  /** Row whose photograph is showing. Defaults to the first collection. */
  const [previewIdx, setPreviewIdx] = useState(0);

  const preview = CANDLE_CATEGORIES[previewIdx] ?? CANDLE_CATEGORIES[0];

  useGSAP(
    () => {
      if (prefersReducedMotion) {
        settleInstantly(['.rail-heading > *', '.rail-row', '.rail-rule']);
        return;
      }

      const tl = gsap.timeline({
        defaults: { ease: EASE.enter },
        scrollTrigger: { trigger: rootRef.current, start: 'top 75%', once: true },
      });

      tl.fromTo(
        '.rail-heading > *',
        { y: 24, opacity: 0 },
        { y: 0, opacity: 1, duration: DURATION.base, stagger: 0.08 }
      )
        .fromTo(
          '.rail-row',
          { y: 28, opacity: 0 },
          { y: 0, opacity: 1, duration: DURATION.base, stagger: 0.07 },
          '-=0.3'
        )
        // Rules draw themselves in. `scaleY` from a top origin rather than
        // `height`, so nothing triggers layout.
        .fromTo(
          '.rail-rule',
          { scaleX: 0 },
          { scaleX: 1, duration: DURATION.base, stagger: 0.07 },
          '-=0.5'
        );
    },
    { scope: rootRef, dependencies: [prefersReducedMotion] }
  );

  // Cross-fade the preview when the pointed-at row changes.
  useGSAP(
    () => {
      if (prefersReducedMotion || !previewRef.current) return;

      gsap.fromTo(
        previewRef.current,
        { opacity: 0, scale: 1.06 },
        { opacity: 1, scale: 1, duration: DURATION.base, ease: EASE.enter }
      );
    },
    { dependencies: [previewIdx, prefersReducedMotion] }
  );

  return (
    <section
      ref={rootRef}
      aria-labelledby="rail-heading"
      className={cn(DESIGN_TOKENS.layout.contained, 'space-y-12')}
    >
      <div className="rail-heading max-w-2xl space-y-4">
        <span className={DESIGN_TOKENS.typography.eyebrow}>
          All {CANDLE_CATEGORIES.length} collections
        </span>
        <h2 id="rail-heading" className={DESIGN_TOKENS.typography.sectionTitle}>
          <span className="text-stone-900 dark:text-stone-100">Every flame begins as</span>{' '}
          <span className="font-semibold text-amber-500">an intention</span>
        </h2>
      </div>

      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        {/* The list. Type-led — this is the interface, not the images. */}
        <ul className="lg:col-span-7">
          {CANDLE_CATEGORIES.map((category, index) => (
            <li key={category.id} className="rail-row">
              <button
                type="button"
                onClick={() => onSelectCategory(category.id)}
                onMouseEnter={() => setPreviewIdx(index)}
                onFocus={() => setPreviewIdx(index)}
                className={cn(
                  'group flex w-full items-baseline gap-4 py-5 text-left transition-colors sm:gap-6 sm:py-7',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 dark:focus-visible:ring-offset-stone-950'
                )}
              >
                <span className="shrink-0 text-xs font-semibold tabular-nums tracking-widest text-amber-500">
                  {String(index + 1).padStart(2, '0')}
                </span>

                <span className="flex-1 space-y-1">
                  <span className="block text-2xl font-light tracking-tight text-stone-900 transition-colors group-hover:text-amber-600 dark:text-stone-100 dark:group-hover:text-amber-400 sm:text-3xl lg:text-4xl">
                    {category.title}
                  </span>
                  <span className="block text-sm font-light text-stone-500 dark:text-stone-400">
                    {category.tagline}
                  </span>
                </span>

                <span className="flex shrink-0 items-center gap-2 self-center">
                  <span className="hidden text-xs font-light tabular-nums text-stone-500 dark:text-stone-400 sm:inline">
                    {category.subCategories.length} varieties
                  </span>
                  <ArrowUpRight
                    className="h-5 w-5 text-stone-400 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-amber-500 dark:text-stone-500"
                    aria-hidden="true"
                  />
                </span>
              </button>

              <span
                aria-hidden="true"
                className="rail-rule block h-px w-full origin-left bg-stone-200 dark:bg-stone-800"
              />
            </li>
          ))}
        </ul>

        {/* Preview frame. One <img> with a swapping src — see the JSDoc. Sticky
            so it stays beside the list while the eye moves down it. */}
        <div className="hidden lg:col-span-5 lg:block">
          <div
            aria-hidden="true"
            className="sticky top-32 overflow-hidden rounded-[2rem] border border-stone-200/70 dark:border-stone-800/70"
          >
            <div className="relative aspect-[4/5]">
              {preview && (
                /* Five of twelve grid columns, and only from `lg` up — so at most
                   ~40vw, capped where `layout.maxWidth` stops the container growing.
                   This is the call site that most needed a real `sizes`: without one
                   the browser assumes `100vw` and fetches the 1344px variant for a
                   frame that is never wider than about 620px. */
                <ResponsiveImage
                  ref={previewRef}
                  key={preview.id}
                  picture={preview.heroImage}
                  alt=""
                  sizes="(min-width: 1600px) 620px, 40vw"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-stone-950/10 dark:bg-stone-950/30" />
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenStory}
        className={cn(
          'group inline-flex items-center gap-3 rounded-full border border-stone-300 px-7 py-4 text-stone-900 transition-colors',
          'hover:border-amber-500 hover:text-amber-600 dark:border-stone-700 dark:text-stone-100 dark:hover:border-amber-400 dark:hover:text-amber-400',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-50 dark:focus-visible:ring-offset-stone-950',
          DESIGN_TOKENS.typography.button
        )}
      >
        See the full story
        <ArrowUpRight
          className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </button>
    </section>
  );
};
