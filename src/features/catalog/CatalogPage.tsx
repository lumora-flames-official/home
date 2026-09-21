import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowLeft, Search, Send } from 'lucide-react';
import { getCatalogGroups, type CatalogGroup } from '../../data/catalog';
import { buildVarietyHash, parseVarietyHash } from '../../lib/deepLink';
import { cn } from '../../lib/utils';
import { DESIGN_TOKENS } from '../../theme/designSystem';
import { VarietyCatalog } from '../categories/VarietyCatalog';
import { CatalogSidebar } from './CatalogSidebar';

gsap.registerPlugin(ScrollTrigger);

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

/**
 * CatalogPage is `/catalog`: every candle currently listed, grouped by variety.
 *
 * This is the buying half of the site, split off from the browsing half. `/collections`
 * tells you what a variety *is*; this tells you what you can actually have, with a price
 * and a product code. The two link into each other at the reader's position, so moving
 * between them never costs the place you had reached.
 *
 * ## Only stocked varieties appear
 *
 * `getCatalogGroups()` omits varieties with nothing listed. With four products across
 * nineteen varieties, including them all would make a page that is fifteen parts
 * "coming soon" — which reads as a broken shop rather than a small one. The collections
 * journey handles the other side of this: an unstocked variety there offers
 * "Commission this" instead of a link to a section that does not exist.
 *
 * ## Reviving a retired URL
 *
 * `/catalog` previously redirected away, having been "a searchable card grid that
 * duplicated the home page's layout". The distinction that makes this page not that one:
 * it lists individual candles with prices and SKUs, which did not exist in the data model
 * then. It must not grow into a second index of collections.
 */
export const CatalogPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [activeKey, setActiveKey] = useState<string | null>(null);

  /**
   * The hash this page was opened with, captured before anything can change it.
   *
   * This page does not mirror the reader's position back into the URL, so live reads
   * would be correct today — but it is captured for the same reason the collections
   * journey has to: StrictMode replays mount effects, and an effect that re-reads
   * `location.hash` is one refactor away from honouring a hash it wrote itself.
   */
  const [arrivalHash] = useState(() => window.location.hash);

  /**
   * Mirror of `activeKey` for reading inside ScrollTrigger callbacks, which close over
   * the render that created them and would otherwise compare against a stale value.
   */
  const activeKeyRef = useRef<string | null>(null);

  const allGroups = getCatalogGroups();

  /*
   * Search across product names, SKUs, fragrance notes, and the variety and collection
   * titles — so "rose" finds a product and "festive" finds everything in a collection.
   * Terms are ANDed, which is how a multi-word search is expected to narrow.
   *
   * A group survives if the *group itself* matches (all its products stay, because
   * searching a collection name means "show me that collection") or, failing that, with
   * only the products that match individually.
   */
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

  const groups: CatalogGroup[] = allGroups.flatMap((group) => {
    if (terms.length === 0) return [group];

    const groupText = `${group.categoryTitle} ${group.varietyName}`.toLowerCase();
    if (terms.every((term) => groupText.includes(term))) return [group];

    const products = group.products.filter((product) => {
      const text = [product.name, product.sku, String(product.priceInr), ...product.fragrance]
        .join(' ')
        .toLowerCase();
      return terms.every((term) => text.includes(term));
    });

    return products.length > 0 ? [{ ...group, products }] : [];
  });

  /** Scrolls a group's section under the sticky chrome. */
  const scrollToGroup = (group: CatalogGroup): void => {
    document.getElementById(domIdForKey(groupKey(group)))?.scrollIntoView({ block: 'start' });
  };

  /**
   * Identity of the currently rendered list, as one string.
   *
   * The scroll-spy below has to rebuild when a search adds or removes sections, but
   * `groups` is a fresh array on every render — depending on it would kill and recreate
   * every trigger on each keystroke *and* on renders that changed nothing. A joined key
   * list changes only when the visible set actually does.
   */
  const visibleKeys = groups.map(groupKey).join('|');

  /*
   * Scroll-spy over the rendered groups.
   *
   * Nothing here is pinned, so plain triggers on the sections are enough — unlike the
   * collections journey, where pinning decouples element position from scroll position.
   * Triggers are built from the key strings so this needs no reference to `groups`.
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
          if (!self.isActive || activeKeyRef.current === key) return;
          activeKeyRef.current = key;
          setActiveKey(key);
        },
      })
    );

    return () => triggers.forEach((trigger) => trigger.kill());
  }, [visibleKeys]);

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

    const group = allGroups.find(
      (candidate) =>
        candidate.categoryId === target.categoryId && candidate.varietyId === target.varietyId
    );
    // The link may name a variety that has since sold out of everything, in which case
    // there is no section to reach and the top of the page is the honest answer.
    if (!group) return;

    let jumped = false;
    const jump = (): void => {
      if (jumped) return;
      jumped = true;

      /*
       * Verified and retried, for the same reason the journey's jump is: a single
       * `scrollIntoView` fires before the page has finished settling. Here the specific
       * hazard is product photography — every image below the fold is lazy, so sections
       * grow as they load and a position computed a frame too early ends up short.
       * Re-checking against the element's own offset absorbs that.
       */
      let attempts = 0;
      const attempt = (): void => {
        attempts += 1;
        const element = document.getElementById(domIdForKey(groupKey(group)));
        if (!element) return;

        element.scrollIntoView({ behavior: 'auto', block: 'start' });

        if (attempts < 10) {
          requestAnimationFrame(() => {
            if (Math.abs(element.getBoundingClientRect().top) > 160) attempt();
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

  const totalProducts = allGroups.reduce((sum, group) => sum + group.products.length, 0);

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
      {/* <header className="max-w-2xl space-y-3">
        <span className={DESIGN_TOKENS.typography.eyebrow}>The catalog</span>
        <h1
          className={cn(
            DESIGN_TOKENS.typography.sectionTitle,
            'text-stone-900 dark:text-stone-100'
          )}
        >
          Every candle currently poured
        </h1>
        <p className={cn(DESIGN_TOKENS.typography.body, 'text-stone-600 dark:text-stone-400')}>
          Each piece is made to order. Message us with a product code and we&apos;ll confirm
          availability, quantity and lead time.
        </p>
      </header> */}

      {totalProducts === 0 ? (
        /*
         * The catalog can legitimately be empty — the studio adds listings through
         * /update-list, and there is no guarantee any exist. A blank page would read as
         * broken, so this says so and offers the one route that always works.
         */
        <section className="max-w-xl space-y-5">
          <p className={cn(DESIGN_TOKENS.typography.body, 'text-stone-600 dark:text-stone-400')}>
            Nothing is listed just yet. Every candle here is poured to order, so the fastest route
            is to tell us what you have in mind.
          </p>
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
        </section>
      ) : (
        <div className="gap-6 lg:grid lg:grid-cols-[16rem_1fr]">
          <CatalogSidebar groups={groups} activeKey={activeKey} onSelect={scrollToGroup} />

          <div className="min-w-0 space-y-16">
            <div className="relative max-w-md">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search the catalog"
                placeholder="Search by name, collection or note…"
                className="w-full rounded-full border border-stone-300 bg-white py-3 pl-11 pr-4 text-sm font-light text-stone-900 outline-none focus-visible:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-500/40 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
              />
            </div>

            {groups.length === 0 ? (
              <p
                className={cn(DESIGN_TOKENS.typography.body, 'text-stone-600 dark:text-stone-400')}
              >
                Nothing matches “{query}”. Try a collection name, a scent note, or a product code.
              </p>
            ) : (
              groups.map((group) => (
                <section
                  key={groupKey(group)}
                  id={domIdForKey(groupKey(group))}
                  /* `scroll-mt` keeps the heading clear of the fixed navbar and the
                     sticky chip rail when a jump lands here. */
                  className="scroll-mt-40 space-y-5 sm:scroll-mt-44"
                >
                  <Link
                    to={{
                      pathname: '/collections',
                      hash: buildVarietyHash(group.categoryId, group.varietyId),
                    }}
                    className={cn(
                      'group inline-flex items-center gap-1.5 text-stone-500 transition-colors hover:text-amber-600 dark:text-stone-400 dark:hover:text-amber-400',
                      DESIGN_TOKENS.typography.button
                    )}
                  >
                    <ArrowLeft
                      className="h-3 w-3 transition-transform group-hover:-translate-x-0.5"
                      aria-hidden="true"
                    />
                    {group.categoryTitle}
                  </Link>

                  <VarietyCatalog
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
          </div>
        </div>
      )}
    </div>
  );
};
