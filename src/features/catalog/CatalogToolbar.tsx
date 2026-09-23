import React from 'react';
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
 * `lg` — the collection tab grid.
 *
 * ## Why it is fixed rather than sticky
 *
 * Search has to be reachable from anywhere in a list, and a list here can be long.
 * Sticky would work for the search row alone, but the tab grid beneath it is the only
 * way to change collections on a phone, and a reader who has scrolled into a
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
}) => (
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
        Below `lg` the sidebar is gone, so this grid is the collection switcher. Three
        columns and two rows rather than a scrolling rail: a rail hides whichever tabs
        are off-screen, and with only six destinations the reader should be able to see
        the whole shape of the catalog without discovering that it scrolls.
      */}
      <nav aria-label="Collections" className="grid grid-cols-3 gap-1.5 lg:hidden">
        {tabs.map((tab) => {
          const isActive = tab.categoryId === activeCategoryId;

          return (
            <button
              key={tab.categoryId}
              type="button"
              onClick={() => onSelectCollection(tab.categoryId)}
              aria-current={isActive}
              // Titles are clamped, so the full name has to reach assistive tech some
              // other way — and the count belongs in the label, not just the badge.
              aria-label={`${tab.title}, ${tab.count} listed`}
              className={cn(
                'flex min-h-11 flex-col justify-center gap-0.5 rounded-xl border px-2 py-1.5 text-left transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500',
                isActive
                  ? 'border-amber-500 bg-amber-500/15 text-amber-800 dark:text-amber-300'
                  : 'border-stone-300 text-stone-600 dark:border-stone-700 dark:text-stone-400'
              )}
            >
              <span className="line-clamp-2 text-[0.625rem] font-semibold uppercase leading-tight tracking-wider">
                {tab.title}
              </span>
              <span
                className="text-[0.625rem] font-light tabular-nums text-stone-500 dark:text-stone-500"
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
