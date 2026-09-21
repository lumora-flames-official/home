import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Send } from 'lucide-react';
import type { CatalogGroup } from '../../data/catalog';
import { cn } from '../../lib/utils';
import { DESIGN_TOKENS } from '../../theme/designSystem';

/** Props for {@link CatalogSidebar}. */
export interface CatalogSidebarProps {
  /** Groups currently listed, already filtered by the page's search. */
  groups: CatalogGroup[];
  /** `categoryId/varietyId` of the group in view, from the page's scroll-spy. */
  activeKey: string | null;
  /** Jumps to a group. */
  onSelect: (group: CatalogGroup) => void;
}

/**
 * Navigation for the catalog: every listed variety, grouped by collection.
 *
 * Sticky on desktop and a horizontally scrolling chip rail on phones. It reflects the
 * *filtered* list, not the whole catalog — a sidebar offering a variety that the current
 * search has hidden would scroll to nothing.
 *
 * ## Why the collection headings are not links
 *
 * A collection is not a scroll target here; only a variety is. Making the heading
 * clickable would raise the question of where it lands — its first variety? — and that
 * is already one click away in the list beneath it. It stays a label.
 */
export const CatalogSidebar: React.FC<CatalogSidebarProps> = ({ groups, activeKey, onSelect }) => {
  const railRef = useRef<HTMLDivElement>(null);

  /*
   * Keeps the active entry visible.
   *
   * `block: 'nearest'` matters on the mobile chip rail: the default would scroll the
   * page vertically to reveal the bar, undoing the scroll position that made this entry
   * active in the first place.
   */
  useEffect(() => {
    const active = railRef.current?.querySelector('[aria-current="true"]');
    active?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [activeKey]);

  /** Collections in listing order, each with the varieties that survived the filter. */
  const byCollection = groups.reduce<{ title: string; groups: CatalogGroup[] }[]>(
    (collections, group) => {
      const last = collections.at(-1);
      if (last && last.title === group.categoryTitle) last.groups.push(group);
      else collections.push({ title: group.categoryTitle, groups: [group] });
      return collections;
    },
    []
  );

  const entryClasses = (isActive: boolean): string =>
    cn(
      'block w-full rounded-lg px-3 py-2 text-left text-sm font-light transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 dark:focus-visible:ring-offset-stone-950',
      isActive
        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
        : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
    );

  return (
    <>
      {/* Desktop: sticky column. `top` clears the fixed navbar. */}
      <nav
        aria-label="Catalog"
        className="sticky top-28 hidden max-h-[calc(100vh-9rem)] flex-col gap-6 overflow-y-auto pr-2 lg:flex"
      >
        <div ref={railRef} className="space-y-5">
          {byCollection.map((collection) => (
            <div key={collection.title} className="space-y-1">
              <p className="px-3 text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                {collection.title}
              </p>
              {collection.groups.map((group) => {
                const key = `${group.categoryId}/${group.varietyId}`;
                const isActive = key === activeKey;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onSelect(group)}
                    aria-current={isActive}
                    className={cn(
                      entryClasses(isActive),
                      'flex items-center justify-between gap-2'
                    )}
                  >
                    <span>{group.varietyName}</span>
                    <span className="shrink-0 text-xs tabular-nums text-stone-400 dark:text-stone-500">
                      {group.products.length}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/*
          The custom-candles route out. Deliberately at the foot of the nav rather than
          in the product flow: someone reads the list first and only wants this if
          nothing in it fits, so it should be permanently available without competing
          with the products for attention.
        */}
        <Link
          to="/contact"
          className={cn(
            'mt-auto flex items-center gap-2.5 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3.5 text-stone-800 transition-colors hover:bg-amber-500/20 dark:text-stone-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500'
          )}
        >
          <Send
            className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400"
            aria-hidden="true"
          />
          <span className="text-xs font-light leading-snug">
            Want something of your own?{' '}
            <span className="font-semibold uppercase tracking-wider">Commission a candle</span>
          </span>
        </Link>
      </nav>

      {/* Phones and tablets: sticky chip rail of varieties, plus the same CTA inline. */}
      <div className="sticky top-20 z-20 -mx-6 mb-8 space-y-3 bg-stone-50/90 px-6 py-3 backdrop-blur-md sm:top-24 sm:-mx-10 sm:px-10 lg:hidden dark:bg-stone-950/90">
        <div
          className={cn(
            'flex gap-2 overflow-x-auto',
            '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
          )}
        >
          {groups.map((group) => {
            const key = `${group.categoryId}/${group.varietyId}`;
            const isActive = key === activeKey;

            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelect(group)}
                aria-current={isActive}
                className={cn(
                  'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-light transition-colors',
                  isActive
                    ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                    : 'border-stone-300 text-stone-600 dark:border-stone-700 dark:text-stone-400'
                )}
              >
                {group.varietyName}
              </button>
            );
          })}
        </div>

        <Link
          to="/contact"
          className={cn(
            'inline-flex items-center gap-2 text-amber-700 dark:text-amber-400',
            DESIGN_TOKENS.typography.button
          )}
        >
          <Send className="h-3 w-3" aria-hidden="true" />
          Commission a candle
        </Link>
      </div>
    </>
  );
};
