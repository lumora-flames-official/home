import React, { useEffect, useRef } from 'react';
import { Link, type To } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import { DESIGN_TOKENS } from '../../theme/designSystem';

/** One collection as the catalog's navigation sees it. */
export interface CatalogTab {
  categoryId: string;
  title: string;
  /** Products currently listed under it, after the search filter. */
  count: number;
}

/** Props for {@link CatalogToolbar}. */
export interface CatalogToolbarProps {
  /** All six collections, in dataset order. */
  tabs: CatalogTab[];
  /** Collection whose list is rendered. */
  activeCategoryId: string;
  /** Switches the rendered collection. */
  onSelectCollection: (categoryId: string) => void;
  /** Current search text. */
  query: string;
  /** Search text changed. */
  onQueryChange: (query: string) => void;
  /** Where the back control returns to — the reader's place in the journey. */
  backTo: To;
  /** What that place is called, e.g. the active collection's title. */
  backLabel: string;
}

/**
 * The catalog's own fixed header: a context-aware back control, search, and — below
 * `lg` — the collection pill rail.
 *
 * ## Why it is fixed rather than sticky
 *
 * Search has to be reachable from anywhere in a list, and a list here can be long.
 * Sticky would work for the search row alone, but the rail beneath it is the only way
 * to change collections without a sidebar, and a reader who has scrolled into a
 * collection is exactly the reader most likely to want a different one.
 *
 * It sits *below* the global navbar rather than at viewport top. The navbar is a
 * floating pill with its own `env(safe-area-inset-top)` padding, so anything at `top-0`
 * would be underneath it; `top-20 sm:top-24` is the same clearance the collections
 * journey's tab bar uses, and keeping the two in step means the two pages' chrome does
 * not jump as you move between them.
 *
 * The `data-catalog-chrome` attribute is a contract with `CatalogPage`, which measures
 * this element to derive the content offset and the sidebar's sticky top. Both would
 * otherwise be hand-tuned numbers that drift the moment a row is added here.
 */
export const CatalogToolbar: React.FC<CatalogToolbarProps> = ({
  tabs,
  activeCategoryId,
  onSelectCollection,
  query,
  onQueryChange,
  backTo,
  backLabel,
}) => {
  const railRef = useRef<HTMLElement>(null);

  /*
   * Keeps the active pill on screen.
   *
   * This is what makes a scrolling rail acceptable at all: without it, paging to a
   * collection with the over-scroll gesture or the foot controls would leave the rail
   * showing a stale position, and a navigation bar that confidently points at the
   * wrong place is worse than no bar — the reader has no reason to distrust it.
   *
   * `block: 'nearest'` is load-bearing. The default would also scroll the *page*
   * vertically to reveal the bar, undoing the scroll position the tab change just set.
   */
  useEffect(() => {
    const active = railRef.current?.querySelector('[aria-current="true"]');
    active?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [activeCategoryId]);

  return (
    <div
      data-catalog-chrome
      className="fixed inset-x-0 top-20 z-30 border-b border-stone-200/70 bg-stone-50/90 backdrop-blur-xl sm:top-24 dark:border-stone-800/70 dark:bg-stone-950/90"
    >
      <div
        className={cn(
          'mx-auto flex flex-col gap-2.5',
          DESIGN_TOKENS.layout.maxWidth,
          DESIGN_TOKENS.layout.paddingX,
          'py-2.5 lg:gap-0 lg:py-3'
        )}
      >
        <div className="flex items-center gap-3">
          {/*
          A real `<Link>`, not a `history.back()` button: the label names a specific
          destination, and a back gesture that lands somewhere other than what it says
          is worse than no gesture. This also survives arriving at /catalog directly,
          where there is no previous entry to go back to.
        */}
          <Link
            to={backTo}
            className={cn(
              'group flex min-w-0 shrink items-center gap-2 rounded-full border border-stone-300 px-3.5 py-2 text-stone-700 transition-colors hover:border-amber-500 hover:text-amber-600',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:text-amber-400 dark:focus-visible:ring-offset-stone-950',
              DESIGN_TOKENS.typography.button
            )}
          >
            <ArrowLeft
              className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:-translate-x-0.5"
              aria-hidden="true"
            />
            {/* Truncated rather than hidden on narrow screens: the whole point of this
              control is that it says where it goes. */}
            <span className="truncate">{backLabel}</span>
          </Link>

          <div className="relative ml-auto w-full max-w-[13rem] shrink-0 sm:max-w-xs lg:max-w-sm">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              aria-label="Search the catalog"
              placeholder="Search candles…"
              className="w-full rounded-full border border-stone-300 bg-white py-2.5 pl-10 pr-3 text-sm font-light text-stone-900 outline-none focus-visible:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-500/40 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
            />
          </div>
        </div>

        {/*
          Below `lg` the sidebar is gone, so this rail is the collection switcher.
          One scrolling row of pills, not the two-row card grid it replaced: that grid
          fitted all six on screen at once but stood ~118px tall, which on a phone is a
          seventh of the viewport spent on six words and six numbers. The rail is ~36px.

          Losing "all six visible at once" is affordable here *because the page names
          the open collection three more times* — this pill, the back control above it,
          and the `Collection N of 6` heading directly beneath. The rail therefore only
          has to answer "what else is there", and partially-cut pills at the edge are
          the standard signal that the answer continues sideways.
        */}
        <nav
          ref={railRef}
          aria-label="Collections"
          className={cn(
            // Negative margin + matching padding so a pill can sit flush with the page
            // gutter while a focus ring at either end is still not clipped.
            '-mx-6 flex gap-2 overflow-x-auto px-6 sm:-mx-10 sm:px-10 lg:hidden',
            '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
          )}
        >
          {tabs.map((tab) => {
            const isActive = tab.categoryId === activeCategoryId;

            return (
              <button
                key={tab.categoryId}
                type="button"
                onClick={() => onSelectCollection(tab.categoryId)}
                aria-current={isActive}
                // The count is rendered `aria-hidden` below, since "Bespoke &
                // Personalized 1" read aloud is ambiguous about what the 1 counts.
                aria-label={`${tab.title}, ${tab.count} listed`}
                className={cn(
                  // `py-2.5` gives a ~37px tall target. Comfortably over the 24px WCAG
                  // 2.5.8 minimum, and the extra 4px over `py-2` is the difference
                  // between a thumb-sized chip and a fiddly one.
                  'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2.5 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1 focus-visible:ring-offset-stone-50 dark:focus-visible:ring-offset-stone-950',
                  DESIGN_TOKENS.typography.buttonxxs,
                  // Filled rather than tinted for the active pill: at this size a
                  // border-plus-wash is hard to pick out of five neighbours at a glance.
                  isActive
                    ? 'border-amber-500 bg-amber-500 text-stone-950'
                    : 'border-stone-300 text-stone-600 hover:border-amber-500/60 dark:border-stone-700 dark:text-stone-400'
                )}
              >
                {tab.title}
                <span
                  className={cn(
                    'tabular-nums',
                    isActive ? 'text-stone-950/60' : 'text-stone-400 dark:text-stone-500'
                  )}
                  aria-hidden="true"
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
