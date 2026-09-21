import React, { useEffect, useRef } from 'react';
import { CANDLE_CATEGORIES } from '../../data/categories';
import { cn } from '../../lib/utils';

/** Props for {@link CollectionTabs}. */
export interface CollectionTabsProps {
  /** Id of the collection currently on screen, from the journey's scroll-spy. */
  activeCategoryId: string;
  /** Jumps the page to a collection. */
  onSelect: (categoryId: string) => void;
}

/**
 * Sticky collection switcher for the journey.
 *
 * The journey is one very long scroll — six collections, nineteen varieties — so this
 * is what stops it being a corridor you can only walk end to end. It answers two
 * questions at once: where am I, and how do I get somewhere else.
 *
 * ## Why buttons and not links
 *
 * These move the scroll position within the current page, so they are buttons. The
 * journey mirrors the choice into `location.hash` afterwards, which keeps the URL
 * shareable without making each tab a navigation — a `<Link>` here would push a
 * history entry per tab and turn Back into "undo one tab" instead of "leave the page".
 *
 * ## Scroll-following on narrow screens
 *
 * Six labels do not fit a phone, so the bar scrolls horizontally and keeps the active
 * tab in view itself. Without that the indicator moves off-screen as you scroll and the
 * bar shows a stale position, which is worse than no bar — you would trust it.
 */
export const CollectionTabs: React.FC<CollectionTabsProps> = ({ activeCategoryId, onSelect }) => {
  const railRef = useRef<HTMLDivElement>(null);

  /*
   * Keeps the active tab visible in the horizontal rail.
   *
   * `block: 'nearest'` is load-bearing: the default would also scroll the *page*
   * vertically to bring the bar into view, which on a pinned page means fighting the
   * scroll position the tab was pressed to reach.
   */
  useEffect(() => {
    const active = railRef.current?.querySelector('[aria-current="true"]');
    active?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [activeCategoryId]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-30 flex justify-center px-3 sm:top-24">
      <nav
        ref={railRef}
        aria-label="Collections"
        className={cn(
          'pointer-events-auto flex max-w-full gap-1 overflow-x-auto rounded-full border border-white/15 bg-stone-950/70 p-1.5 backdrop-blur-xl',
          '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
        )}
      >
        {CANDLE_CATEGORIES.map((category, index) => {
          const isActive = category.id === activeCategoryId;

          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onSelect(category.id)}
              aria-current={isActive}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-1 focus-visible:ring-offset-stone-950',
                // Fixed dark surface in both themes, so no `dark:` variants — the bar
                // sits over photography, which is dark whatever the page theme is.
                isActive ? 'bg-amber-500 text-stone-950' : 'text-stone-300 hover:text-white'
              )}
            >
              {/* The number alone below `sm`: six full titles cannot fit a phone, and a
                  truncated title is less legible than an index plus the active label. */}
              <span className="sm:hidden tabular-nums">{String(index + 1).padStart(2, '0')}</span>
              <span className="hidden sm:inline">{category.title}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
