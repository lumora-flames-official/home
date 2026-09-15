import React, { useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { ArrowLeft, Send, Sparkles } from 'lucide-react';
import type { Category } from '../../types/category';
import { InteractiveCandleCanvas } from '../../components/canvas/InteractiveCandleCanvas';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { cn } from '../../lib/utils';
import { DESIGN_TOKENS } from '../../theme/designSystem';
import { EASE, DURATION } from '../../lib/animations';
import { CollectionCatalog } from './CollectionCatalog';

gsap.registerPlugin(ScrollTrigger);

/** Props for {@link SubCategoryShowcase}. */
export interface SubCategoryShowcaseProps {
  /** The collection whose varieties are being explored. */
  category: Category;
  /** Returns to the collections story. */
  onBack: () => void;
  /**
   * Opens the bespoke inquiry for a specific variety, receiving a prefilled
   * subject line, e.g. `"Traditional & Festive — Urli & Diya Candles"`.
   */
  onOrderCustom: (subject: string) => void;
}

/**
 * SubCategoryShowcase is the immersive subcategory experience: one pinned stage
 * where scrolling morphs a single procedural candle through every variety in the
 * collection, with the narrative panel cross-fading in step.
 *
 * This replaces two earlier components that both listed the same data — a pinned
 * two-column card (`ScrollInteractiveShowcase`) and a separate grid of variety
 * cards (`CategoryDetail`) one click deeper. Merging them removes the duplicate
 * route and makes the walkthrough itself the destination.
 *
 * ## Scroll mechanics
 *
 * The stage pins for `varieties × 100vh` of scroll. Index is derived from scroll
 * progress, but committed to React state **only when it actually changes** — the
 * previous implementation called `setState` on every scroll frame, re-rendering
 * the tree continuously. The comparison is held in a ref rather than read from
 * state so the `onUpdate` callback never closes over a stale value.
 *
 * With reduced motion preferred, pinning is skipped entirely and all varieties
 * render as a plain stacked list.
 */
export const SubCategoryShowcase: React.FC<SubCategoryShowcaseProps> = ({
  category,
  onBack,
  onOrderCustom,
}) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const [activeIndex, setActiveIndex] = useState(0);
  /**
   * Mirrors `activeIndex` for use inside the ScrollTrigger callback. GSAP's
   * `onUpdate` closure is created once per timeline build, so reading state
   * directly there would capture the value from that render forever — the bug
   * that left the old flame-lit flag permanently stuck.
   */
  const activeIndexRef = useRef(0);

  const varieties = category.subCategories;
  const total = varieties.length;

  useGSAP(
    () => {
      if (prefersReducedMotion || total === 0) return;

      const trigger = ScrollTrigger.create({
        trigger: stageRef.current,
        start: 'top top',
        // One viewport of scroll per variety gives each one room to be read.
        end: `+=${total * 100}%`,
        pin: true,
        // Snap to variety boundaries so the stage never rests mid-transition.
        snap: total > 1 ? { snapTo: 1 / (total - 1), duration: 0.35, ease: EASE.enter } : undefined,
        onUpdate: (self) => {
          // `progress` reaches exactly 1 at the end, which would round past the
          // last index — clamp instead of letting it overflow.
          const next = Math.min(Math.floor(self.progress * total), total - 1);
          if (next !== activeIndexRef.current) {
            activeIndexRef.current = next;
            setActiveIndex(next);
          }
        },
      });

      return () => trigger.kill();
    },
    { scope: stageRef, dependencies: [category.id, total, prefersReducedMotion] }
  );

  // Cross-fade the narrative panel whenever the active variety changes. Keyed off
  // activeIndex rather than run from the scroll timeline, so it plays identically
  // for scroll, snap, and the progress-rail buttons.
  useGSAP(
    () => {
      if (prefersReducedMotion || !panelRef.current) return;

      gsap.fromTo(
        panelRef.current.children,
        { y: 22, opacity: 0 },
        { y: 0, opacity: 1, duration: DURATION.base, stagger: 0.07, ease: EASE.enter }
      );
    },
    { scope: panelRef, dependencies: [activeIndex, prefersReducedMotion] }
  );

  if (total === 0) {
    return (
      <section
        className={cn('mx-auto max-w-xl px-6 py-32 text-center', DESIGN_TOKENS.layout.headerOffset)}
      >
        <h1
          className={cn(
            DESIGN_TOKENS.typography.sectionTitle,
            'text-stone-900 dark:text-stone-100'
          )}
        >
          {category.title}
        </h1>
        <p className={cn(DESIGN_TOKENS.typography.body, 'mt-4 text-stone-600 dark:text-stone-400')}>
          This collection is being photographed and written up. Tell us what you have in mind and
          we&apos;ll pour it to order.
        </p>
        <button
          type="button"
          onClick={() => onOrderCustom(category.title)}
          className={cn(
            'mt-8 rounded-full bg-amber-500 px-7 py-3.5 text-stone-950 transition-colors hover:bg-amber-400',
            DESIGN_TOKENS.typography.button
          )}
        >
          Start a bespoke inquiry
        </button>
      </section>
    );
  }

  const active = varieties[activeIndex];

  /** Narrative panel for one variety. Shared by the pinned and stacked layouts. */
  const renderNarrative = (index: number, withPanelRef: boolean) => {
    const variety = varieties[index];

    return (
      <div ref={withPanelRef ? panelRef : undefined} className="space-y-6">
        <span className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-amber-500">
          <span className="tabular-nums">{String(index + 1).padStart(2, '0')}</span>
          <span className="h-px w-10 bg-current opacity-40" aria-hidden="true" />
          Variety {index + 1} of {total}
        </span>

        <h2
          className={cn(DESIGN_TOKENS.typography.panelTitle, 'text-stone-900 dark:text-stone-100')}
        >
          {variety.name}
        </h2>

        <p
          className={cn(
            DESIGN_TOKENS.typography.body,
            'max-w-xl text-stone-600 dark:text-stone-400'
          )}
        >
          {variety.description}
        </p>

        {variety.examples.length > 0 && (
          <div className="space-y-3 pt-1">
            <span className="block text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Popular formats
            </span>
            <ul className="flex flex-wrap gap-2">
              {variety.examples.map((example) => (
                <li
                  key={example}
                  className="rounded-full border border-stone-300/70 bg-white/70 px-3.5 py-1.5 text-xs font-light text-stone-800 backdrop-blur-sm dark:border-stone-800 dark:bg-stone-900/70 dark:text-stone-200"
                >
                  {example}
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="button"
          onClick={() => onOrderCustom(`${category.title} — ${variety.name}`)}
          className={cn(
            'mt-2 inline-flex items-center gap-2.5 rounded-full bg-amber-500 px-7 py-3.5 text-stone-950 shadow-lg transition-colors hover:bg-amber-400',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-50 dark:focus-visible:ring-offset-stone-950',
            DESIGN_TOKENS.typography.button
          )}
        >
          <Send className="h-3.5 w-3.5" />
          Commission this
        </button>
      </div>
    );
  };

  /** Back link + collection title, shown above both layouts. */
  const header = (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className={cn(
          'inline-flex items-center gap-2 text-stone-600 transition-colors hover:text-amber-500 dark:text-stone-400 dark:hover:text-amber-400',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-full',
          DESIGN_TOKENS.typography.button
        )}
      >
        <ArrowLeft className="h-4 w-4" /> All collections
      </button>

      <div className="space-y-2">
        <span className={DESIGN_TOKENS.typography.eyebrow}>
          <Sparkles className="mr-1.5 inline h-3.5 w-3.5" />
          {category.tagline}
        </span>
        <h1
          className={cn(
            DESIGN_TOKENS.typography.sectionTitle,
            'text-stone-900 dark:text-stone-100'
          )}
        >
          {category.title}
        </h1>
      </div>
    </div>
  );

  // Reduced motion: no pinning, no scroll hijack — every variety stacked plainly.
  if (prefersReducedMotion) {
    return (
      <>
        <div
          className={cn(
            'mx-auto space-y-20',
            DESIGN_TOKENS.layout.maxWidth,
            DESIGN_TOKENS.layout.paddingX,
            DESIGN_TOKENS.layout.headerOffset,
            'pb-24'
          )}
        >
          {header}
          {varieties.map((variety, index) => (
            <section
              key={variety.id}
              className="grid items-center gap-10 border-t border-stone-200 pt-14 lg:grid-cols-2 dark:border-stone-800"
            >
              <div className="flex justify-center">
                <InteractiveCandleCanvas
                  flameIntensity={1}
                  visual={variety.visual}
                  label={variety.name}
                />
              </div>
              {renderNarrative(index, false)}
            </section>
          ))}
        </div>

        <CollectionCatalog category={category} />
      </>
    );
  }

  return (
    <>
      <div ref={stageRef} className="relative min-h-screen w-full overflow-hidden">
        <div
          className={cn(
            'mx-auto flex min-h-screen flex-col justify-center',
            DESIGN_TOKENS.layout.maxWidth,
            DESIGN_TOKENS.layout.paddingX,
            DESIGN_TOKENS.layout.headerOffset,
            'pb-16'
          )}
        >
          {header}

          <div className="mt-10 grid flex-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
            {/* The candle: one object that reshapes itself per variety. */}
            <div className="flex items-center justify-center">
              <InteractiveCandleCanvas
                flameIntensity={1}
                visual={active.visual}
                label={active.name}
              />
            </div>

            {renderNarrative(activeIndex, true)}
          </div>

          {/* Progress rail. Also a control — clicking jumps to that variety, so the
            content stays reachable without scrubbing the whole stage. */}
          <nav aria-label="Varieties" className="mt-10 flex items-center gap-2.5">
            {varieties.map((variety, index) => (
              <button
                key={variety.id}
                type="button"
                aria-label={variety.name}
                aria-current={index === activeIndex}
                onClick={() => {
                  activeIndexRef.current = index;
                  setActiveIndex(index);
                }}
                className="group flex h-11 items-center focus-visible:outline-none"
              >
                <span
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-500',
                    index === activeIndex
                      ? 'w-12 bg-amber-500'
                      : 'w-5 bg-stone-300 group-hover:bg-amber-500/50 dark:bg-stone-700'
                  )}
                />
              </button>
            ))}
            <span className="ml-3 text-xs font-light tabular-nums text-stone-500 dark:text-stone-400">
              Scroll to explore
            </span>
          </nav>
        </div>
      </div>

      {/*
        Outside the pinned stage on purpose. Sitting inside it would either put a
        horizontal-scroll rail inside a scroll-jacked pin, or pin the rail to
        whichever variety is active — and the rail only becomes visible once the
        pin releases, by which point that is always the last one. See
        `CollectionCatalog`.
      */}
      <CollectionCatalog category={category} />
    </>
  );
};
