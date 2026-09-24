import React, { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import type { CatalogProduct } from '../../types/catalog';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { DURATION, EASE, STAGGER, settleInstantly } from '../../lib/animations';
import { ProductCard } from './ProductCard';

gsap.registerPlugin(ScrollTrigger);

/** Props for {@link VarietyCatalog}. */
export interface VarietyCatalogProps {
  /**
   * Products to show, already selected by the caller.
   *
   * Passed in rather than looked up from ids, which is what this component used to do.
   * `/catalog` filters by a search query, so it has to decide which products exist
   * *before* rendering — a component that fetched its own data could only be told which
   * variety to show, never which subset of it, and the page would have had to duplicate
   * the same lookup to know whether the grid would end up empty.
   */
  products: readonly CatalogProduct[];
  /** Rendered as the grid's heading. */
  heading: string;
  /** Ties the heading to the section for assistive technology. */
  headingId: string;
  /** Opens a candle's detail dialog. Owned by the page, so one dialog serves all. */
  onOpenProduct: (product: CatalogProduct) => void;
}

/**
 * The candles listed under one variety, as a responsive grid.
 *
 * Purely presentational: it renders the products it is given. Returns `null` for an
 * empty list so a caller can hand it a filtered set without first checking whether
 * anything survived the filter.
 *
 * ## Why a grid and not the horizontal rail this used to be
 *
 * The rail existed when a variety was one band inside a long vertical page and could
 * not have the width. `/catalog` now renders one collection at a time, so the width is
 * there — and a rail spends it by hiding products behind a sideways gesture that only
 * touch and trackpad users discover. Two columns on a phone also put twice as much in
 * a glance, which is the whole point of a catalogue.
 *
 * GSAP is used for exactly one thing here — the tiles' entrance — and that is skipped
 * under reduced motion.
 */
export const VarietyCatalog: React.FC<VarietyCatalogProps> = ({
  products,
  heading,
  headingId,
  onOpenProduct,
}) => {
  const sectionRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useGSAP(
    () => {
      const cards = gridRef.current?.children;
      if (!cards || cards.length === 0) return;

      if (prefersReducedMotion) {
        // Nothing has run yet, but clear anyway: a props change can rebuild this
        // callback after a tween already applied a transform, which would otherwise
        // leave a tile stranded mid-reveal and possibly invisible.
        settleInstantly(cards);
        return;
      }

      gsap.fromTo(
        cards,
        { y: 24, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: DURATION.base,
          stagger: STAGGER,
          ease: EASE.enter,
          scrollTrigger: {
            trigger: sectionRef.current,
            // Fires a little before the top edge, so the reveal has finished by the
            // time the row is actually being read.
            start: 'top 85%',
            once: true,
          },
        }
      );
    },
    { scope: sectionRef, dependencies: [headingId, products.length, prefersReducedMotion] }
  );

  // Nothing to show. Returning null rather than an empty-state row is what lets the
  // catalog page pass a search-filtered list straight through without pre-checking it.
  if (products.length === 0) return null;

  return (
    <section ref={sectionRef} aria-labelledby={headingId} className="space-y-4">
      <div className="space-y-1">
        <h3
          id={headingId}
          className="text-xl font-light tracking-tight text-stone-900 sm:text-2xl dark:text-stone-100"
        >
          {heading}
        </h3>
        <p className="text-xs font-light tabular-nums text-stone-500 dark:text-stone-400">
          {products.length} {products.length === 1 ? 'piece' : 'pieces'}
        </p>
      </div>

      <div
        ref={gridRef}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4 2xl:grid-cols-5"
      >
        {products.map((product, index) => (
          <ProductCard
            key={product.sku}
            product={product}
            onOpen={onOpenProduct}
            // Roughly a first row, whatever the breakpoint; the rest are below the fold.
            eager={index < 4}
          />
        ))}
      </div>
    </section>
  );
};
