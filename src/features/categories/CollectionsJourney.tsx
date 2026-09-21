import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { CANDLE_CATEGORIES } from '../../data/categories';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { buildVarietyHash, parseCollectionHash, type VarietyTarget } from '../../lib/deepLink';
import { cn } from '../../lib/utils';
import { DESIGN_TOKENS } from '../../theme/designSystem';
import { DURATION, EASE, settleInstantly } from '../../lib/animations';
import { CollectionTabs } from './CollectionTabs';
import { VarietyStage } from './VarietyStage';

gsap.registerPlugin(ScrollTrigger);

/**
 * Entrance assigned to each collection, by position.
 *
 * Carried over from the retired `CollectionsStoryView`, where six separate screens
 * each resolved differently. Now that the six are one continuous page, the treatment
 * marks *arriving at a collection* — so the rule it exists to serve still holds: no two
 * collections announce themselves the same way, and the page never becomes one effect
 * repeated six times.
 */
type CollectionEntrance = 'clip' | 'parallax' | 'scale' | 'slide' | 'zoom' | 'tilt';

const ENTRANCES: CollectionEntrance[] = ['clip', 'parallax', 'scale', 'slide', 'zoom', 'tilt'];

/**
 * Plays one collection's arrival.
 *
 * @param entrance Which treatment to use.
 * @param frame The block's content wrapper — a node that survives variety changes, so
 *   this never competes with the per-variety cross-fade happening inside it.
 */
const playEntrance = (entrance: CollectionEntrance, frame: HTMLElement): void => {
  const base = { duration: DURATION.slow, ease: EASE.enter };

  switch (entrance) {
    case 'clip':
      gsap.fromTo(
        frame,
        { clipPath: 'polygon(0 0, 0 0, 0 100%, 0 100%)', opacity: 0 },
        { clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)', opacity: 1, ...base }
      );
      break;
    case 'parallax':
      gsap.fromTo(frame, { y: 110, opacity: 0 }, { y: 0, opacity: 1, ...base });
      break;
    case 'scale':
      gsap.fromTo(
        frame,
        { scale: 0.78, opacity: 0 },
        { scale: 1, opacity: 1, duration: DURATION.slow, ease: 'back.out(1.6)' }
      );
      break;
    case 'slide':
      gsap.fromTo(frame, { x: -90, opacity: 0 }, { x: 0, opacity: 1, ...base });
      break;
    case 'zoom':
      gsap.fromTo(frame, { scale: 1.14, opacity: 0 }, { scale: 1, opacity: 1, ...base });
      break;
    case 'tilt':
      gsap.fromTo(frame, { rotateX: 34, opacity: 0 }, { rotateX: 0, opacity: 1, ...base });
      break;
  }
};

/**
 * CollectionsJourney is `/collections`: the whole catalogue of *ideas*, as one scroll.
 *
 * Six pinned blocks, one per collection. Each holds its collection's photograph still
 * while scrolling steps through that collection's varieties, then releases and the next
 * collection takes over. A sticky tab bar says which collection you are in and jumps to
 * any other.
 *
 * ## What this replaced, and why
 *
 * Two components: a `/collections` page of six cinematic screens that each needed a
 * click, and a `/category/:id` page that then walked that collection's varieties. The
 * first screen said what a collection was and then asked you to pick one, which the
 * second page immediately restated — a whole navigation step that added no information.
 * They are merged rather than sitting side by side because two components showing the
 * same data is the most expensive mistake available here: both keep working and only
 * one is right.
 *
 * ## Why the pin is per collection and not per variety
 *
 * Nineteen pinned stages would work and would look wrong: three consecutive varieties
 * share one photograph, so the same image would unpin and re-pin three times, restarting
 * its drift each time. One pin per collection holds the photograph steady for the whole
 * run — which is also exactly how a reader describes it: "keep the collection, change
 * the variety".
 *
 * ## Scroll position is not element position
 *
 * A pinned block's DOM node sits inside a pin-spacer, so `scrollIntoView` on it lands
 * somewhere unrelated to where the pin starts. Every jump therefore uses the block's
 * own `ScrollTrigger.start`, captured on refresh — see {@link scrollToTarget}. In the
 * reduced-motion branch nothing is pinned and `scrollIntoView` is correct, so there are
 * deliberately two strategies.
 */
export const CollectionsJourney: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  // `HTMLElement`, not `HTMLDivElement`: each block is a `<section>`.
  const blockRefs = useRef<(HTMLElement | null)[]>([]);
  const frameRefs = useRef<(HTMLDivElement | null)[]>([]);
  const contentRefs = useRef<(HTMLDivElement | null)[]>([]);
  const prefersReducedMotion = useReducedMotion();

  /**
   * Scroll bounds of each block's pin, captured on every ScrollTrigger refresh.
   *
   * Held in a ref and not state: these change on resize and are only read inside event
   * handlers, so storing them in state would re-render the whole journey on every
   * refresh for values nothing renders.
   */
  const boundsRef = useRef<{ start: number; end: number }[]>([]);

  /**
   * Whether the hash the page was opened with has been dealt with.
   *
   * This exists to stop the two hash effects below from destroying each other, which they
   * did in a way worth spelling out because the symptom pointed nowhere near the cause.
   *
   * The mirroring effect writes the reader's position into the hash continuously. Its
   * first write happens at the default position — collection 1, variety 1 — and it
   * happens immediately, before the deep-link jump has run. This component is behind
   * `React.lazy` + `Suspense` and so can mount, suspend and mount again; on the second
   * mount the deep link read the hash and found *our own* default, so every link to every
   * collection scrolled to exactly the same place: half a viewport into the first block.
   * Six different URLs, one identical wrong result, and nothing in the parsing to blame.
   *
   * So mirroring stays silent until arrival is handled. Nothing re-renders when this
   * flips, which is fine: the jump itself moves the scroll, that fires `onUpdate`, and the
   * resulting state change runs the mirroring effect with the right position.
   */
  const arrivalHandledRef = useRef(false);

  const [activeCategory, setActiveCategory] = useState(0);
  const [activeVarieties, setActiveVarieties] = useState<number[]>(() =>
    CANDLE_CATEGORIES.map(() => 0)
  );

  /*
   * Mirrors of the two pieces of state above, for reading inside GSAP callbacks.
   *
   * A ScrollTrigger callback closes over the render that created it, so reading state
   * directly would capture a value that never updates — the bug already documented on
   * the retired `SubCategoryShowcase`, where a flame flag stayed stuck forever.
   */
  const activeCategoryRef = useRef(0);
  const activeVarietiesRef = useRef<number[]>(CANDLE_CATEGORIES.map(() => 0));

  /**
   * Scroll position that puts a variety on screen, or `null` if it cannot be computed
   * yet — which happens when the block's pin has not measured itself.
   *
   * Derived from the block's pin bounds rather than from any element: the block is
   * pinned, so its element is not where its scroll range is. The half-step offset lands
   * in the *middle* of the variety's share of the range; exactly on the boundary,
   * `Math.floor(progress * total)` can resolve to the previous variety.
   */
  const targetScrollTop = (target: VarietyTarget): number | null => {
    const categoryIndex = CANDLE_CATEGORIES.findIndex((c) => c.id === target.categoryId);
    if (categoryIndex === -1) return null;

    const category = CANDLE_CATEGORIES[categoryIndex];
    const varietyIndex = category.subCategories.findIndex((v) => v.id === target.varietyId);
    if (varietyIndex === -1) return null;

    const bounds = boundsRef.current[categoryIndex];
    if (!bounds) return null;

    const step = (bounds.end - bounds.start) / category.subCategories.length;
    return bounds.start + step * (varietyIndex + 0.5);
  };

  /** Scrolls to a variety. Used by the tabs and the per-collection progress rail. */
  const scrollToTarget = (target: VarietyTarget, smooth: boolean): void => {
    if (prefersReducedMotion) {
      // Nothing is pinned, so the element *is* the position.
      document
        .getElementById(`stage-${target.categoryId}-${target.varietyId}`)
        ?.scrollIntoView({ behavior: 'auto', block: 'start' });
      return;
    }

    const top = targetScrollTop(target);
    if (top === null) return;

    window.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
  };

  useGSAP(
    () => {
      const frames = frameRefs.current.filter((frame): frame is HTMLDivElement => frame !== null);

      if (prefersReducedMotion) {
        // Clear rather than merely skip: a motion-preference change rebuilds this
        // callback, and a frame left mid-tween would otherwise stay invisible.
        settleInstantly(frames);
        return;
      }

      const triggers = CANDLE_CATEGORIES.map((category, categoryIndex) => {
        const block = blockRefs.current[categoryIndex];
        const frame = frameRefs.current[categoryIndex];
        const photo = block?.querySelector('.collection-photo');
        const total = category.subCategories.length;

        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: block,
            start: 'top top',
            // One viewport of scroll per variety, so each gets room to be read.
            end: `+=${total * 100}%`,
            pin: true,
            scrub: 1,
            onRefresh: (self) => {
              boundsRef.current[categoryIndex] = { start: self.start, end: self.end };
            },
            onToggle: (self) => {
              if (!self.isActive || activeCategoryRef.current === categoryIndex) return;
              activeCategoryRef.current = categoryIndex;
              setActiveCategory(categoryIndex);
            },
            onEnter: () =>
              frame && playEntrance(ENTRANCES[categoryIndex % ENTRANCES.length], frame),
            onEnterBack: () =>
              frame && playEntrance(ENTRANCES[categoryIndex % ENTRANCES.length], frame),
            onUpdate: (self) => {
              // `progress` reaches exactly 1 at the end, which would round past the
              // last variety — clamp rather than letting it overflow.
              const next = Math.min(Math.floor(self.progress * total), total - 1);
              if (next === activeVarietiesRef.current[categoryIndex]) return;

              const updated = [...activeVarietiesRef.current];
              updated[categoryIndex] = next;
              activeVarietiesRef.current = updated;
              setActiveVarieties(updated);
            },
          },
        });

        // Slow push on the photograph across the whole collection, under everything
        // else. Transform only — scrubbing a layout property would reflow per frame.
        if (photo) timeline.to(photo, { scale: 1.16, yPercent: 5, ease: EASE.scrub }, 0);

        return timeline.scrollTrigger;
      });

      return () => triggers.forEach((trigger) => trigger?.kill());
    },
    { scope: rootRef, dependencies: [prefersReducedMotion] }
  );

  // Cross-fade the variety content whenever the active variety changes. Driven off
  // state rather than the scroll timeline so it plays identically for scrolling, tab
  // jumps and deep links.
  useGSAP(
    () => {
      if (prefersReducedMotion) return;

      const content = contentRefs.current[activeCategory];
      if (!content) return;

      gsap.fromTo(
        content.children,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: DURATION.base, stagger: 0.06, ease: EASE.enter }
      );
    },
    { dependencies: [activeCategory, activeVarieties[activeCategory], prefersReducedMotion] }
  );

  /**
   * Honours a deep link like `/collections#specialty-wax/sand-botanical` on arrival.
   *
   * This is the most stubborn piece of code on the page, so here is what it is up against.
   *
   * **`ScrollTrigger.refresh()` moves the scroll.** To re-measure pins it sets the scroll
   * to 0, reads the layout, then restores the position it saved when the refresh began.
   * Several refreshes fire while this page is arriving — one per pin creation, and one from
   * `PageTransition` when its enter tween completes — and each restores a position from
   * *before* our jump. A single `scrollTo`, however well timed, is therefore reverted a
   * moment later. Every wrong result while building this came from that: the jump ran, the
   * scroll landed on the correct pixel, and a refresh then put it back.
   *
   * **Bounds are not final when the first refresh fires.** Six pinned blocks each add a
   * pin-spacer, and each spacer changes the document for the blocks after it, so a
   * trigger's `start` is only trustworthy once all six exist.
   *
   * So: re-apply the target after every refresh for a short settle window, recomputing it
   * each time rather than trusting the first value, and stop early the moment the reader
   * touches the page. Calling `ScrollTrigger.refresh()` here would be actively harmful —
   * it adds another position-restoring refresh to the very sequence being fought.
   */
  useEffect(() => {
    const target = parseCollectionHash(window.location.hash);

    // No deep link: mirroring is free to start straight away.
    if (!target) {
      arrivalHandledRef.current = true;
      return;
    }

    /** Events that mean the reader has taken over and must not be overridden. */
    const HAND_OVER = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;

    let released = false;
    const deadline = performance.now() + 1400;

    const release = (): void => {
      if (released) return;
      released = true;
      arrivalHandledRef.current = true;

      ScrollTrigger.removeEventListener('refresh', onRefresh);
      for (const event of HAND_OVER) window.removeEventListener(event, release);
      window.clearTimeout(backstop);
    };

    const apply = (): void => {
      if (released) return;

      const top = targetScrollTop(target);
      if (top !== null) window.scrollTo({ top, behavior: 'auto' });

      if (performance.now() > deadline) release();
    };

    /*
     * A frame later, not immediately: the `refresh` event fires around ScrollTrigger's own
     * scroll restoration, so re-applying synchronously can be undone by the same refresh
     * that prompted it.
     */
    const onRefresh = (): void => {
      requestAnimationFrame(apply);
    };

    ScrollTrigger.addEventListener('refresh', onRefresh);
    for (const event of HAND_OVER) {
      window.addEventListener(event, release, { passive: true, once: true });
    }

    /*
     * Also runs on its own cadence until the deadline. Refresh events alone are not
     * enough — the bounds may only become usable between two of them, and there is no
     * event for "the pins finally agree".
     */
    const tick = (): void => {
      if (released) return;
      apply();
      if (!released) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    const backstop = window.setTimeout(release, 1600);

    return release;
    /*
     * Mount only. The hash is read imperatively rather than as a dependency because every
     * later change to it originates *here* — see the mirroring effect below — so depending
     * on it would re-run this on our own writes and fight the reader's scroll. Navigations
     * that legitimately change the hash are handled by the router-driven effect below.
     */
  }, []);

  /**
   * Handles a link to a *different* variety while already on this page.
   *
   * The mount effect above only runs once, which is not enough: the footer lists all six
   * collections, and following one of those from `/collections` changes only the hash. That
   * is a same-document navigation — `pathname` never changes, the component never
   * remounts, and without this the link would visibly do nothing at all.
   *
   * Reading the hash from the router rather than from `window.location` is what makes this
   * safe to run on every change. The mirroring effect below writes with
   * `history.replaceState`, which deliberately bypasses React Router, so `location.hash`
   * here only moves in response to a real navigation and never to our own bookkeeping.
   */
  const routerHash = useLocation().hash;
  const handledRouterHashRef = useRef<string | null>(null);

  useEffect(() => {
    // The first value belongs to the mount effect, which has the settle-window handling.
    if (handledRouterHashRef.current === null) {
      handledRouterHashRef.current = routerHash;
      return;
    }
    if (handledRouterHashRef.current === routerHash) return;
    handledRouterHashRef.current = routerHash;

    const target = parseCollectionHash(routerHash);
    if (target) scrollToTarget(target, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routerHash]);

  /*
   * Mirrors the current position into the URL so a reload or a shared link resumes here.
   *
   * `history.replaceState` and not `navigate`: this fires on every variety change, and
   * pushing history would turn Back into "undo one scroll step". Replacing also avoids
   * telling React Router about a change nothing re-renders on.
   *
   * Gated on arrival being handled — see `arrivalHandledRef` for why writing too early
   * made every deep link resolve to the same wrong place.
   */
  useEffect(() => {
    if (!arrivalHandledRef.current) return;

    const category = CANDLE_CATEGORIES[activeCategory];
    const variety = category.subCategories[activeVarieties[activeCategory]];
    if (!variety) return;

    window.history.replaceState(null, '', buildVarietyHash(category.id, variety.id));
  }, [activeCategory, activeVarieties]);

  return (
    <div ref={rootRef} className="relative w-full">
      <CollectionTabs
        activeCategoryId={CANDLE_CATEGORIES[activeCategory].id}
        onSelect={(categoryId) => {
          const category = CANDLE_CATEGORIES.find((c) => c.id === categoryId);
          const firstVariety = category?.subCategories[0];
          if (category && firstVariety) {
            scrollToTarget({ categoryId: category.id, varietyId: firstVariety.id }, true);
          }
        }}
      />

      {CANDLE_CATEGORIES.map((category, categoryIndex) => {
        const varieties = category.subCategories;
        const activeIndex = activeVarieties[categoryIndex];

        return (
          <section
            key={category.id}
            ref={(node) => {
              blockRefs.current[categoryIndex] = node;
            }}
            aria-labelledby={`collection-${category.id}`}
            className={cn(
              'relative flex w-full flex-col justify-center overflow-hidden',
              prefersReducedMotion ? 'py-24' : 'h-screen'
            )}
          >
            {/* Photograph + scrims. One per collection, held still by the pin. */}
            <div className="absolute inset-0 z-0 overflow-hidden">
              <img
                src={category.heroImage}
                alt={`${category.title} — ${category.tagline}`}
                /* Only the first collection is above the fold. */
                loading={categoryIndex === 0 ? 'eager' : 'lazy'}
                decoding="async"
                className="collection-photo h-full w-full object-cover brightness-[0.55] dark:brightness-[0.4]"
              />
              <div className={cn('absolute inset-0', DESIGN_TOKENS.overlay.scrimSide)} />
              <div className={cn('absolute inset-0', DESIGN_TOKENS.overlay.scrimBottom)} />
            </div>

            {/* Screen-reader anchor for the collection. The visible collection name is
                inside the eyebrow of each stage, which is decorative repetition. */}
            <h2 id={`collection-${category.id}`} className="sr-only">
              {category.title}
            </h2>

            <div
              ref={(node) => {
                frameRefs.current[categoryIndex] = node;
              }}
              className={cn(
                'relative z-10 mx-auto w-full',
                DESIGN_TOKENS.layout.maxWidth,
                DESIGN_TOKENS.layout.paddingX,
                prefersReducedMotion ? 'space-y-24' : 'pt-32 sm:pt-36'
              )}
            >
              {prefersReducedMotion ? (
                /*
                 * Reduced motion: no pin, no scroll hijack, no cross-fade — every
                 * variety is simply present and addressable by its own element id,
                 * which is what makes `scrollIntoView` the right jump here.
                 */
                varieties.map((variety, index) => (
                  <div key={variety.id} id={`stage-${category.id}-${variety.id}`}>
                    <VarietyStage
                      category={category}
                      variety={variety}
                      index={index}
                      total={varieties.length}
                      showCollectionDescription={index === 0}
                    />
                  </div>
                ))
              ) : (
                <div
                  ref={(node) => {
                    contentRefs.current[categoryIndex] = node;
                  }}
                >
                  <VarietyStage
                    category={category}
                    variety={varieties[activeIndex]}
                    index={activeIndex}
                    total={varieties.length}
                    showCollectionDescription={activeIndex === 0}
                  />
                </div>
              )}

              {/* Variety progress rail. Also a control, so the content stays reachable
                  without scrubbing the whole block. */}
              {!prefersReducedMotion && (
                <nav
                  aria-label={`${category.title} varieties`}
                  className="mt-10 flex items-center gap-2.5"
                >
                  {varieties.map((variety, index) => (
                    <button
                      key={variety.id}
                      type="button"
                      aria-label={variety.name}
                      aria-current={index === activeIndex}
                      onClick={() =>
                        scrollToTarget({ categoryId: category.id, varietyId: variety.id }, true)
                      }
                      className="group flex h-11 items-center focus-visible:outline-none"
                    >
                      <span
                        className={cn(
                          'h-1.5 rounded-full transition-all duration-500',
                          // Fixed dark surface, so no `dark:` variants.
                          index === activeIndex
                            ? 'w-12 bg-amber-500'
                            : 'w-5 bg-white/40 group-hover:bg-amber-400/70'
                        )}
                      />
                    </button>
                  ))}
                  <span className="ml-3 text-xs font-light tabular-nums text-stone-300">
                    {String(activeIndex + 1).padStart(2, '0')} /{' '}
                    {String(varieties.length).padStart(2, '0')}
                  </span>
                </nav>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
};
