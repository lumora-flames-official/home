import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowDown, ArrowUp, Send } from 'lucide-react';
import {
  getCatalogCollections,
  type CatalogCollection,
  type CatalogGroup,
} from '../../data/catalog';
import type { CatalogProduct } from '../../types/catalog';
import { buildVarietyHash, parseVarietyHash } from '../../lib/deepLink';
import { cn } from '../../lib/utils';
import { DESIGN_TOKENS } from '../../theme/designSystem';
import { VarietyCatalog } from '../categories/VarietyCatalog';
import { CatalogSidebar } from './CatalogSidebar';
import { CatalogToolbar, type CatalogTab } from './CatalogToolbar';
import { useTabOverscroll } from './useTabOverscroll';

gsap.registerPlugin(ScrollTrigger);

/**
 * Clearance below the fixed chrome, used until the real measurement lands.
 *
 * Only ever visible for the first painted frame, and that frame is at opacity 0 under
 * `PageTransition`'s entrance. Sized for the *deepest* case — the mobile bar, whose
 * two-row tab grid puts its bottom edge at ~271px against desktop's ~163px — so that
 * being wrong leaves a gap rather than putting content underneath the bar.
 */
const CHROME_FALLBACK = '17rem';

/**
 * Frames a newly opened collection holds its landing position, ~300ms at 60Hz.
 *
 * Long enough to outlast a flick's inertia and a font swap; short enough that it never
 * feels like the page is resisting a scroll the reader actually meant.
 */
const LANDING_FRAMES = 18;

/** Stable key for a group, used for scroll-spy identity and DOM ids alike. */
const groupKey = (group: CatalogGroup): string => `${group.categoryId}/${group.varietyId}`;

/**
 * DOM id for a group's section, derived from its key.
 *
 * Deliberately *not* the same string as the URL hash. If they matched, the browser's
 * native "scroll to the element whose id is in the hash" would fire on load and race the
 * page's own positioning, which has to wait for layout — two scrolls, arriving in an
 * unpredictable order. Keeping them different means every jump goes through one path.
 *
 * Takes the key rather than the group so the scroll-spy can rebuild its triggers from
 * keys alone, which is what lets that effect depend on a single string instead of on an
 * array rebuilt every render.
 */
const domIdForKey = (key: string): string => `catalog-group-${key.replace('/', '-')}`;

/** Whether a group's own titles satisfy every search term. */
const groupMatches = (group: CatalogGroup, terms: string[]): boolean => {
  const text = `${group.categoryTitle} ${group.varietyName}`.toLowerCase();
  return terms.every((term) => text.includes(term));
};

/** Whether one product satisfies every search term. */
const productMatches = (product: CatalogProduct, terms: string[]): boolean => {
  const text = [product.name, product.sku, String(product.priceInr), ...product.fragrance]
    .join(' ')
    .toLowerCase();
  return terms.every((term) => text.includes(term));
};

/**
 * Narrows a collection to what matches the search.
 *
 * A group survives *whole* when the group itself matches — searching a collection or
 * variety name means "show me that section", not "show me only the products whose names
 * happen to repeat it". Failing that it survives with just its matching products.
 *
 * Terms are ANDed, which is how a multi-word query is expected to narrow.
 */
const filterCollection = (collection: CatalogCollection, terms: string[]): CatalogCollection => {
  if (terms.length === 0) return collection;

  const groups = collection.groups.flatMap((group) => {
    if (groupMatches(group, terms)) return [group];

    const products = group.products.filter((product) => productMatches(product, terms));
    return products.length > 0 ? [{ ...group, products }] : [];
  });

  return {
    ...collection,
    groups,
    productCount: groups.reduce((total, group) => total + group.products.length, 0),
  };
};

/**
 * CatalogPage is `/catalog`: every candle currently listed, one collection at a time.
 *
 * This is the buying half of the site, split off from the browsing half. `/collections`
 * tells you what a variety *is*; this tells you what you can actually have, with a price
 * and a product code. The two link into each other at the reader's position, so moving
 * between them never costs the place you had reached.
 *
 * ## Why one collection at a time
 *
 * The page used to render all nineteen stocked varieties as one scroll. That is a cost
 * which grows with the studio's success: every product ever added lands in the first
 * commit of the DOM, the scroll height stops meaning anything as a sense of position,
 * and the scroll-spy keeps a live trigger per section whether or not it is near the
 * viewport. Paginating by collection makes the rendered work proportional to one
 * collection rather than the whole catalog, and hands the list the full page width —
 * which is what lets the products sit in a grid instead of behind a sideways gesture.
 *
 * What that removes is continuous scrolling, so it is given back explicitly:
 * over-scrolling past the bottom opens the next collection, and past the top reopens
 * the previous one at *its* bottom. See `useTabOverscroll` for why that reads input
 * intent rather than scroll position.
 *
 * ## Empty collections are destinations, not gaps
 *
 * Three of the six collections list nothing today. Their tabs are still present and
 * still selectable — the tab strip is the shape of the catalogue, and hiding half of it
 * would leave no way to learn that a collection exists but is unstocked. What they
 * cannot be is an *automatic* destination: over-scroll paging skips them, because
 * landing somewhere with nothing to scroll is a dead end rather than a continuation.
 */
export const CatalogPage: React.FC = () => {
  const allCollections = getCatalogCollections();

  const [query, setQuery] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  /**
   * The hash this page was opened with, captured before anything can change it.
   *
   * This page does not mirror the reader's position back into the URL, so live reads
   * would be correct today — but it is captured for the same reason the collections
   * journey has to: StrictMode replays mount effects, and an effect that re-reads
   * `location.hash` is one refactor away from honouring a hash it wrote itself.
   */
  const [arrivalHash] = useState(() => window.location.hash);

  /** Collection whose list is rendered: the deep link's, else the first stocked one. */
  const [activeCategoryId, setActiveCategoryId] = useState(() => {
    const target = parseVarietyHash(arrivalHash);
    if (target && allCollections.some((c) => c.categoryId === target.categoryId)) {
      return target.categoryId;
    }
    return (allCollections.find((c) => c.productCount > 0) ?? allCollections[0]).categoryId;
  });

  /** Variety in view, from the scroll-spy. `null` until a trigger has reported. */
  const [activeVarietyKey, setActiveVarietyKey] = useState<string | null>(null);

  /**
   * Mirror of {@link activeVarietyKey} for reading inside ScrollTrigger callbacks,
   * which close over the render that created them and would otherwise compare against
   * a stale value.
   */
  const activeVarietyKeyRef = useRef<string | null>(null);

  const pageRef = useRef<HTMLDivElement>(null);

  /**
   * Where to land once a requested collection has rendered.
   *
   * Keyed by collection rather than held as a bare flag so it is idempotent: a
   * StrictMode effect replay re-applies the same landing, instead of finding the flag
   * already consumed and silently skipping the scroll.
   */
  const pendingLandingRef = useRef<{ categoryId: string; landing: 'top' | 'bottom' } | null>(null);

  /** Search terms, lowercased and ANDed. */
  const splitTerms = (value: string): string[] => value.toLowerCase().split(/\s+/).filter(Boolean);

  const terms = splitTerms(query);
  const collections = allCollections.map((collection) => filterCollection(collection, terms));

  const activeIndex = Math.max(
    0,
    collections.findIndex((c) => c.categoryId === activeCategoryId)
  );
  const active = collections[activeIndex];

  const tabs: CatalogTab[] = collections.map((collection) => ({
    categoryId: collection.categoryId,
    title: collection.categoryTitle,
    count: collection.productCount,
  }));

  /** Nearest collection in `step` direction that has something to show, or `null`. */
  const adjacentListed = (step: -1 | 1): CatalogCollection | null => {
    for (let i = activeIndex + step; i >= 0 && i < collections.length; i += step) {
      if (collections[i].groups.length > 0) return collections[i];
    }
    return null;
  };

  const previousCollection = adjacentListed(-1);
  const nextCollection = adjacentListed(1);

  /**
   * Opens a collection, recording where the reader should land in it.
   *
   * @param categoryId Collection to render.
   * @param landing `'bottom'` when arriving by scrolling *backwards*, so the reader
   *   continues from where that list ended rather than being thrown to its top.
   */
  const openCollection = (categoryId: string, landing: 'top' | 'bottom' = 'top'): void => {
    if (categoryId === activeCategoryId) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }

    pendingLandingRef.current = { categoryId, landing };
    setActiveCategoryId(categoryId);
  };

  /**
   * Applies a search and, when it empties the open collection, moves to one that has
   * results.
   *
   * Done in the handler rather than derived from the new query during render: only one
   * collection is mounted, so a search whose every match is elsewhere would otherwise
   * show "nothing matches" while the results sat one tab away — and correcting that in
   * render would mean writing the landing ref mid-render, which React forbids.
   */
  const handleQueryChange = (next: string): void => {
    setQuery(next);

    const nextTerms = splitTerms(next);
    if (filterCollection(allCollections[activeIndex], nextTerms).groups.length > 0) return;

    const withResults = allCollections.find(
      (collection) => filterCollection(collection, nextTerms).groups.length > 0
    );
    if (withResults) openCollection(withResults.categoryId, 'top');
  };

  useTabOverscroll({
    // Nothing to page to means nothing to listen for — a one-result search should not
    // leave the window subscribed to every wheel event.
    enabled: previousCollection !== null || nextCollection !== null,
    onNext: () => nextCollection && openCollection(nextCollection.categoryId, 'top'),
    onPrevious: () => previousCollection && openCollection(previousCollection.categoryId, 'bottom'),
  });

  /*
   * Publishes the fixed chrome's height as `--catalog-chrome`, in px.
   *
   * Written to the DOM rather than held in state: the sidebar's sticky offset, the
   * content's top padding and every section's scroll margin all need this number, and a
   * state update would re-render the whole product list on every resize frame to deliver
   * it. A custom property reaches all three through inheritance at no cost.
   *
   * Three signals, because the bar's *bottom edge* moves for three unrelated reasons:
   *
   * - The observer catches the bar growing or shrinking — the tab grid rewrapping.
   * - `resize` catches its `top` changing at the `sm` breakpoint, which is not a change
   *   to its own box and so is invisible to the observer.
   * - `ScrollTrigger`'s `refresh` catches the page-entrance tween finishing. That one is
   *   not optional: `PageTransition` animates `y` on an ancestor, and a transformed
   *   ancestor becomes the containing block for `position: fixed` descendants — so a
   *   measurement taken mid-tween is offset by however far through the tween it was,
   *   and every offset derived from it inherits the error. `PageTransition` refreshes
   *   once the tween has cleared its transform, which is exactly when to re-measure.
   */
  useEffect(() => {
    const page = pageRef.current;
    const chrome = page?.querySelector<HTMLElement>('[data-catalog-chrome]');
    if (!page || !chrome) return;

    const sync = (): void => {
      page.style.setProperty('--catalog-chrome', `${chrome.getBoundingClientRect().bottom}px`);
    };

    sync();

    const observer = new ResizeObserver(sync);
    observer.observe(chrome);
    window.addEventListener('resize', sync);
    ScrollTrigger.addEventListener('refresh', sync);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', sync);
      ScrollTrigger.removeEventListener('refresh', sync);
    };
  }, []);

  /** Identity of the rendered sections, as one string — the scroll-spy's only input. */
  const visibleKeys = active.groups.map(groupKey).join('|');

  /*
   * Scroll-spy over the rendered groups.
   *
   * Nothing here is pinned, so plain triggers on the sections are enough — unlike the
   * collections journey, where pinning decouples element position from scroll position.
   * Triggers are built from the key strings so this needs no reference to `groups`, and
   * only one collection's worth exists at a time.
   */
  useEffect(() => {
    const triggers = (visibleKeys ? visibleKeys.split('|') : []).map((key) =>
      ScrollTrigger.create({
        trigger: `#${domIdForKey(key)}`,
        // A band around the upper third: the group whose heading has just passed under
        // the chrome is the one being read.
        start: 'top 35%',
        end: 'bottom 35%',
        onToggle: (self) => {
          if (!self.isActive || activeVarietyKeyRef.current === key) return;
          activeVarietyKeyRef.current = key;
          setActiveVarietyKey(key);
        },
      })
    );

    return () => triggers.forEach((trigger) => trigger.kill());
  }, [visibleKeys]);

  /*
   * Applies the landing position after a collection change.
   *
   * Runs *after* the scroll-spy effect above by source order, and that matters:
   * creating a ScrollTrigger measures the document, and measuring can move the scroll
   * position. Positioning last gives this the final say.
   *
   * The position is re-asserted every frame for {@link LANDING_FRAMES}, not set once,
   * because two different things would otherwise undo it:
   *
   * - **Inertia.** The flick that triggered the change is still being delivered. Those
   *   events are observed passively, so the browser scrolls on them as normal, and a
   *   real trackpad flick carries far more travel than the threshold that committed —
   *   set the position once and the reader is thrown straight past the new collection's
   *   heading by whatever momentum was left. Holding the position for the length of the
   *   inertial tail is what makes the transition land where it says it does. Keeping
   *   that to a few hundred milliseconds is deliberate: a deliberate scroll that
   *   outlasts it wins, which is the right outcome.
   * - **Layout.** Bottom-landing depends on `scrollHeight`, and web fonts and the
   *   sidebar's own reflow still move it. (Card images do not — their wrapper carries a
   *   fixed aspect ratio.) A height read one frame early lands short, which reads as
   *   "the previous collection opened in the middle".
   */
  useEffect(() => {
    const pending = pendingLandingRef.current;
    if (!pending || pending.categoryId !== activeCategoryId) return;

    let frames = 0;
    let raf = 0;

    const settle = (): void => {
      const target =
        pending.landing === 'top' ? 0 : document.documentElement.scrollHeight - window.innerHeight;

      window.scrollTo({ top: Math.max(0, target), behavior: 'auto' });
      if (++frames < LANDING_FRAMES) raf = requestAnimationFrame(settle);
    };

    settle();

    return () => cancelAnimationFrame(raf);
  }, [activeCategoryId]);

  /**
   * Honours `/catalog#<categoryId>/<varietyId>` on arrival.
   *
   * Same timing problem as the collections journey, for the same reason: `PageTransition`
   * scrolls to top on a route change and refreshes ScrollTrigger only once its enter
   * tween finishes, so scrolling before that is both mis-measured and about to be undone.
   * Waiting for the first refresh — with a timeout in case one never arrives — is the
   * only moment that is reliably after both.
   */
  useEffect(() => {
    const target = parseVarietyHash(arrivalHash);
    if (!target) return;

    const group = allCollections
      .find((collection) => collection.categoryId === target.categoryId)
      ?.groups.find((candidate) => candidate.varietyId === target.varietyId);

    // The link may name a variety that has since sold out of everything, in which case
    // there is no section to reach and the top of the collection is the honest answer.
    if (!group) return;

    let jumped = false;
    const jump = (): void => {
      if (jumped) return;
      jumped = true;

      let attempts = 0;
      const attempt = (): void => {
        attempts += 1;
        const element = document.getElementById(domIdForKey(groupKey(group)));
        if (!element) return;

        element.scrollIntoView({ behavior: 'auto', block: 'start' });

        // Verified and retried: a single `scrollIntoView` can fire before the page has
        // finished settling, and the scroll margin is itself a measured value.
        if (attempts < 10) {
          requestAnimationFrame(() => {
            if (Math.abs(element.getBoundingClientRect().top) > 240) attempt();
          });
        }
      };

      attempt();
    };

    ScrollTrigger.addEventListener('refresh', jump);
    const backstop = window.setTimeout(jump, 900);

    return () => {
      ScrollTrigger.removeEventListener('refresh', jump);
      window.clearTimeout(backstop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on mount only.
  }, []);

  /** Scrolls to a variety inside the open collection. */
  const scrollToVariety = (group: CatalogGroup): void => {
    document
      .getElementById(domIdForKey(groupKey(group)))
      ?.scrollIntoView({ behavior: 'auto', block: 'start' });
  };

  /*
   * Which variety the sidebar marks.
   *
   * Falls back to the collection's first group rather than clearing on a tab change:
   * the spy's key belongs to whichever collection was open when it fired, so after a
   * change it names a section that is no longer rendered. Resolving it here means no
   * extra state to reset and no frame with nothing marked.
   */
  const firstKey = active.groups[0] ? groupKey(active.groups[0]) : null;
  const highlightKey =
    activeVarietyKey && active.groups.some((group) => groupKey(group) === activeVarietyKey)
      ? activeVarietyKey
      : firstKey;

  /*
   * The back control points at the reader's actual position in the journey, not at the
   * collection's opener — someone who arrived here from the third variety should be
   * returned to the third variety. `#<categoryId>` alone is a valid target too:
   * `parseCollectionHash` resolves it to the collection's first variety.
   */
  const backHash = highlightKey
    ? buildVarietyHash(active.categoryId, highlightKey.split('/')[1])
    : `#${active.categoryId}`;

  const totalProducts = allCollections.reduce(
    (total, collection) => total + collection.productCount,
    0
  );

  const commissionCta = (
    <Link
      to="/contact"
      className={cn(
        'inline-flex items-center gap-2.5 rounded-full bg-amber-500 px-7 py-3.5 text-stone-950 transition-colors hover:bg-amber-400',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-50 dark:focus-visible:ring-offset-stone-950',
        DESIGN_TOKENS.typography.button
      )}
    >
      <Send className="h-3.5 w-3.5" aria-hidden="true" />
      Commission a candle
    </Link>
  );

  /*
   * The catalog can legitimately be empty — the studio adds listings through
   * /update-list, and there is no guarantee any exist. A blank page would read as
   * broken, so this says so and offers the one route that always works. Rendered
   * instead of the chrome rather than inside it: tabs and a search box over nothing are
   * furniture for a shop that has not opened.
   */
  if (totalProducts === 0) {
    return (
      <div
        className={cn(
          'mx-auto',
          DESIGN_TOKENS.layout.maxWidth,
          DESIGN_TOKENS.layout.paddingX,
          DESIGN_TOKENS.layout.headerOffset,
          'pb-28'
        )}
      >
        <section className="max-w-xl space-y-5">
          <h1
            className={cn(
              DESIGN_TOKENS.typography.sectionTitle,
              'text-stone-900 dark:text-stone-100'
            )}
          >
            The catalog
          </h1>
          <p className={cn(DESIGN_TOKENS.typography.body, 'text-stone-600 dark:text-stone-400')}>
            Nothing is listed just yet. Every candle here is poured to order, so the fastest route
            is to tell us what you have in mind.
          </p>
          {commissionCta}
        </section>
      </div>
    );
  }

  const pagerClasses = cn(
    'inline-flex max-w-full items-center gap-2 rounded-full border border-stone-300 px-5 py-3 text-stone-700 transition-colors hover:border-amber-500 hover:text-amber-600',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:text-amber-400 dark:focus-visible:ring-offset-stone-950',
    DESIGN_TOKENS.typography.button
  );

  return (
    <div
      ref={pageRef}
      // Overwritten in px by the measuring effect. React never reverts it: the style
      // prop's contents are identical on every render, so there is nothing to diff.
      style={{ '--catalog-chrome': CHROME_FALLBACK } as React.CSSProperties}
    >
      <CatalogToolbar
        tabs={tabs}
        activeCategoryId={active.categoryId}
        onSelectCollection={(categoryId) => openCollection(categoryId)}
        query={query}
        onQueryChange={handleQueryChange}
        backTo={{ pathname: '/collections', hash: backHash }}
        backLabel={active.categoryTitle}
      />

      <div
        className={cn(
          // Extra bottom clearance below `lg` so the floating commission pill cannot
          // cover the last row of cards or the pager buttons at full scroll.
          'mx-auto pb-32 lg:pb-24',
          DESIGN_TOKENS.layout.maxWidth,
          DESIGN_TOKENS.layout.paddingX
        )}
        style={{ paddingTop: 'calc(var(--catalog-chrome) + 1.5rem)' }}
      >
        <div
          className={cn(
            'lg:grid lg:items-start lg:gap-8',
            // Both literals appear so Tailwind emits both tracks; a template string
            // built from the state would compile to neither.
            sidebarCollapsed
              ? 'lg:grid-cols-[4.5rem_minmax(0,1fr)]'
              : 'lg:grid-cols-[16rem_minmax(0,1fr)]'
          )}
        >
          <CatalogSidebar
            tabs={tabs}
            groups={active.groups}
            activeCategoryId={active.categoryId}
            activeVarietyKey={highlightKey}
            collapsed={sidebarCollapsed}
            onToggleCollapsed={() => setSidebarCollapsed((collapsed) => !collapsed)}
            onSelectCollection={(categoryId) => openCollection(categoryId)}
            onSelectVariety={scrollToVariety}
          />

          <div className="min-w-0 space-y-14">
            <header className="space-y-2">
              <span className={DESIGN_TOKENS.typography.eyebrow}>
                Collection {activeIndex + 1} of {collections.length}
              </span>
              <h1
                className={cn(
                  DESIGN_TOKENS.typography.sectionTitle,
                  'text-stone-900 dark:text-stone-100'
                )}
              >
                {active.categoryTitle}
              </h1>
              <p className="text-xs font-light tabular-nums text-stone-500 dark:text-stone-400">
                {active.productCount} {active.productCount === 1 ? 'candle' : 'candles'} listed
                {terms.length > 0 && ' for this search'}
              </p>
            </header>

            {active.groups.length === 0 ? (
              <section className="max-w-xl space-y-5">
                <p
                  className={cn(
                    DESIGN_TOKENS.typography.body,
                    'text-stone-600 dark:text-stone-400'
                  )}
                >
                  {terms.length > 0
                    ? `Nothing in ${active.categoryTitle} matches “${query}”. Try another collection, a scent note, or a product code.`
                    : `${active.categoryTitle} has nothing listed yet. Everything here is poured to order, so this one starts with a conversation.`}
                </p>
                {terms.length === 0 && commissionCta}
              </section>
            ) : (
              active.groups.map((group) => (
                <section
                  key={groupKey(group)}
                  id={domIdForKey(groupKey(group))}
                  // Keeps a jumped-to heading clear of the fixed chrome, from the same
                  // measurement the layout uses rather than a matching magic number.
                  style={{ scrollMarginTop: 'calc(var(--catalog-chrome) + 1.5rem)' }}
                >
                  <VarietyCatalog
                    layout="grid"
                    products={group.products}
                    heading={group.varietyName}
                    headingId={`${domIdForKey(groupKey(group))}-heading`}
                    context={{
                      categoryTitle: group.categoryTitle,
                      varietyName: group.varietyName,
                    }}
                  />
                </section>
              ))
            )}

            {/*
              The accessible half of the paging mechanism. Over-scroll is a shortcut for
              a pointer; these are the only way through the catalog with a keyboard or a
              screen reader, so they are real controls and not a hint about gestures.
            */}
            {(previousCollection || nextCollection) && (
              <nav
                aria-label="Collections"
                className="flex flex-wrap items-center justify-between gap-4 border-t border-stone-200 pt-10 dark:border-stone-800"
              >
                {previousCollection ? (
                  <button
                    type="button"
                    onClick={() => openCollection(previousCollection.categoryId, 'bottom')}
                    className={pagerClasses}
                  >
                    <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{previousCollection.categoryTitle}</span>
                  </button>
                ) : (
                  <span />
                )}

                {nextCollection && (
                  <button
                    type="button"
                    onClick={() => openCollection(nextCollection.categoryId, 'top')}
                    className={pagerClasses}
                  >
                    <span className="truncate">{nextCollection.categoryTitle}</span>
                    <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  </button>
                )}
              </nav>
            )}
          </div>
        </div>
      </div>

      {/*
        The commission route out, for the widths where the sidebar that normally carries
        it is hidden. Floating rather than placed at the foot of the list: this page
        continues into the next collection when you reach the bottom, so a CTA down there
        is somewhere the reader is actively prevented from arriving at.

        Bottom-right and pill-shaped rather than a full-width bar — it has to stay
        reachable over a scrolling grid without covering the card underneath it. The
        `env()` padding keeps it clear of a home-bar gesture area.
      */}
      <Link
        to="/contact"
        className={cn(
          'fixed bottom-0 right-0 z-30 m-4 mb-[max(1rem,env(safe-area-inset-bottom))] inline-flex items-center gap-2 rounded-full bg-amber-500 px-5 py-3.5 text-stone-950 shadow-xl transition-colors hover:bg-amber-400 lg:hidden',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 dark:focus-visible:ring-offset-stone-950',
          DESIGN_TOKENS.typography.button
        )}
      >
        <Send className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Commission a candle
      </Link>
    </div>
  );
};
