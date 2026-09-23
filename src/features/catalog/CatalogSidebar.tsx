import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, Send } from 'lucide-react';
import type { CatalogGroup } from '../../data/catalog';
import { cn } from '../../lib/utils';
import type { CatalogTab } from './CatalogToolbar';

/** Props for {@link CatalogSidebar}. */
export interface CatalogSidebarProps {
  /** All six collections, in dataset order. */
  tabs: CatalogTab[];
  /** Varieties of the active collection, already filtered by the page's search. */
  groups: CatalogGroup[];
  /** Collection whose list is rendered. */
  activeCategoryId: string;
  /** `categoryId/varietyId` of the variety in view, from the page's scroll-spy. */
  activeVarietyKey: string | null;
  /** Whether the rail is in its slim, index-width state. */
  collapsed: boolean;
  /** Toggles {@link collapsed}. */
  onToggleCollapsed: () => void;
  /** Switches the rendered collection. */
  onSelectCollection: (categoryId: string) => void;
  /** Scrolls to a variety within the rendered collection. */
  onSelectVariety: (group: CatalogGroup) => void;
}

/**
 * Desktop navigation rail for the catalog: six collections, the active one expanded
 * into its varieties.
 *
 * Sticky rather than `position: fixed`. Both satisfy "does not scroll with the page",
 * but the rail is a grid column inside a centred max-width container, and a fixed
 * element leaves that flow — on a display wider than 1600px it would anchor to the
 * viewport edge while the content it belongs to stayed centred, opening a gap that
 * grows with the monitor. Sticky keeps it welded to the column and costs nothing.
 *
 * ## Why only the active collection lists its varieties
 *
 * The page renders one collection at a time, so a variety in another collection is not
 * a scroll target — clicking it has to change tabs first. Showing all nineteen as
 * though they were one list would promise a continuous scroll the page deliberately
 * does not have. Collapsed to a single row each, the other five stay one click away.
 *
 * ## Collapsed state
 *
 * Two-digit indices, not icons. There is no glyph that means "Specialty Wax", and a
 * generic one repeated six times would be decoration pretending to be navigation. The
 * numbers match the order the reader met the collections in on `/collections`, and the
 * full title stays on every row's `title` and `aria-label`.
 */
export const CatalogSidebar: React.FC<CatalogSidebarProps> = ({
  tabs,
  groups,
  activeCategoryId,
  activeVarietyKey,
  collapsed,
  onToggleCollapsed,
  onSelectCollection,
  onSelectVariety,
}) => {
  const listRef = useRef<HTMLDivElement>(null);

  /*
   * Keeps the active variety visible when the rail overflows its viewport slot.
   *
   * `block: 'nearest'` is load-bearing: the default would scroll the *page* to bring
   * the row into view, undoing the scroll position that made it active in the first
   * place — a feedback loop between the spy and its own indicator.
   */
  useEffect(() => {
    const active = listRef.current?.querySelector('[data-variety-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeVarietyKey]);

  return (
    <nav
      aria-label="Catalog"
      /* Offsets derive from the chrome measurement on the page root, so adding a row
         to the toolbar cannot leave this tucked underneath it. */
      style={{
        top: 'calc(var(--catalog-chrome) + 1rem)',
        maxHeight: 'calc(100vh - var(--catalog-chrome) - 2.5rem)',
      }}
      className="sticky hidden flex-col gap-4 lg:flex"
    >
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Expand catalog navigation' : 'Collapse catalog navigation'}
        title={collapsed ? 'Expand' : 'Collapse'}
        className={cn(
          'flex h-9 shrink-0 items-center gap-2 rounded-lg px-2.5 text-xs font-semibold uppercase tracking-wider text-stone-500 transition-colors hover:text-amber-600',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:text-stone-400 dark:hover:text-amber-400',
          collapsed ? 'justify-center' : 'self-start'
        )}
      >
        {collapsed ? (
          <PanelLeftOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
        ) : (
          <>
            <PanelLeftClose className="h-4 w-4 shrink-0" aria-hidden="true" />
            Collapse
          </>
        )}
      </button>

      <div ref={listRef} className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {tabs.map((tab, index) => {
          const isActive = tab.categoryId === activeCategoryId;

          return (
            <div key={tab.categoryId}>
              <button
                type="button"
                onClick={() => onSelectCollection(tab.categoryId)}
                aria-current={isActive}
                title={tab.title}
                aria-label={`${tab.title}, ${tab.count} listed`}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg py-2 text-left transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 dark:focus-visible:ring-offset-stone-950',
                  collapsed ? 'justify-center px-0' : 'px-3',
                  isActive
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                    : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
                )}
              >
                <span
                  className={cn(
                    'shrink-0 text-xs font-semibold tabular-nums',
                    isActive ? 'text-amber-600 dark:text-amber-400' : 'text-stone-400'
                  )}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>

                {!collapsed && (
                  <>
                    <span className="min-w-0 flex-1 truncate text-sm font-light">{tab.title}</span>
                    <span className="shrink-0 text-xs tabular-nums text-stone-400 dark:text-stone-500">
                      {tab.count}
                    </span>
                  </>
                )}
              </button>

              {/* The active collection's varieties, as in-page jump targets. Hidden
                  when collapsed: at index width there is no room for a second level. */}
              {isActive && !collapsed && groups.length > 0 && (
                <ul className="ml-3 mt-1 space-y-0.5 border-l border-stone-200 pl-3 dark:border-stone-800">
                  {groups.map((group) => {
                    const key = `${group.categoryId}/${group.varietyId}`;
                    const isCurrent = key === activeVarietyKey;

                    return (
                      <li key={key}>
                        <button
                          type="button"
                          onClick={() => onSelectVariety(group)}
                          data-variety-active={isCurrent}
                          aria-current={isCurrent}
                          className={cn(
                            'flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-light transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500',
                            isCurrent
                              ? 'text-amber-700 dark:text-amber-300'
                              : 'text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
                          )}
                        >
                          <span className="min-w-0 truncate">{group.varietyName}</span>
                          <span className="shrink-0 tabular-nums text-stone-400 dark:text-stone-500">
                            {group.products.length}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/*
        The custom-candles route out. Deliberately at the foot of the rail rather than
        in the product flow: someone reads the list first and only wants this if
        nothing in it fits, so it should be permanently available without competing
        with the products for attention.
      */}
      <Link
        to="/contact"
        title="Commission a candle"
        className={cn(
          'flex shrink-0 items-center gap-2.5 rounded-2xl border border-amber-500/40 bg-amber-500/10 py-3 text-stone-800 transition-colors hover:bg-amber-500/20 dark:text-stone-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500',
          collapsed ? 'justify-center px-0' : 'px-4'
        )}
      >
        <Send
          className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400"
          aria-hidden="true"
        />
        {collapsed ? (
          <span className="sr-only">Commission a candle</span>
        ) : (
          <span className="text-xs font-light leading-snug">
            Want something of your own?{' '}
            <span className="font-semibold uppercase tracking-wider">Commission a candle</span>
          </span>
        )}
      </Link>
    </nav>
  );
};
