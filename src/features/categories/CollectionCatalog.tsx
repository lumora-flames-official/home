import React from 'react';
import type { Category } from '../../types/category';
import { countCollectionProducts } from '../../data/catalog';
import { cn } from '../../lib/utils';
import { DESIGN_TOKENS } from '../../theme/designSystem';
import { VarietyCatalog } from './VarietyCatalog';

/** Props for {@link CollectionCatalog}. */
export interface CollectionCatalogProps {
  /** The collection whose products are being listed. */
  category: Category;
}

/**
 * The shoppable half of a collection page: one product rail per variety.
 *
 * ## Why this sits after the pinned stage rather than inside it
 *
 * The brief asked for a rail "directly beneath each variety section", but in the
 * default (non-reduced-motion) view there are no per-variety sections to nest
 * under — `SubCategoryShowcase` is a *single* stage pinned for
 * `varieties × 100vh` that morphs one candle through each variety in turn. The two
 * available places to put a rail inside it both fail:
 *
 * - In the narrative panel, swapping with the active variety: a horizontal-scroll
 *   container inside a scroll-jacked pin makes a diagonal swipe a coin toss
 *   between scrubbing the stage and scrolling the rail.
 * - Below the pinned stage but driven by the active index: the rail is only
 *   visible once the pin has released, at which point the index is always at the
 *   last variety, so it would permanently show one variety's products.
 *
 * Placing the catalog after the pin releases makes scroll ownership unambiguous —
 * vertical scroll belongs to the stage, then to the page — and lets every variety's
 * products be seen without scrubbing back through the walkthrough. In the
 * reduced-motion branch, where varieties *are* stacked sections, the same
 * component lands literally beneath them.
 *
 * Renders `null` until at least one product exists anywhere in the collection, so
 * the page is unchanged from today until content is added through `/update-list`.
 */
export const CollectionCatalog: React.FC<CollectionCatalogProps> = ({ category }) => {
  if (countCollectionProducts(category.id) === 0) return null;

  const headingId = `collection-catalog-${category.id}`;

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'mx-auto border-t border-stone-200 py-20 sm:py-28 dark:border-stone-800',
        DESIGN_TOKENS.layout.maxWidth,
        DESIGN_TOKENS.layout.paddingX
      )}
    >
      <div className="max-w-2xl space-y-3">
        <span className={DESIGN_TOKENS.typography.eyebrow}>Available now</span>
        <h2
          id={headingId}
          className={cn(
            DESIGN_TOKENS.typography.sectionTitle,
            'text-stone-900 dark:text-stone-100'
          )}
        >
          The {category.title} collection
        </h2>
        <p className={cn(DESIGN_TOKENS.typography.body, 'text-stone-600 dark:text-stone-400')}>
          Each piece is poured to order. Message us with a product code and we&apos;ll confirm
          availability, quantity and lead time.
        </p>
      </div>

      {/* Varieties with nothing listed return null, so this maps the full set
          rather than pre-filtering — one source of ordering, and a variety
          becomes visible the moment its first product is added. */}
      <div className="mt-14 space-y-16 sm:mt-16 sm:space-y-20">
        {category.subCategories.map((variety) => (
          <VarietyCatalog key={variety.id} categorySlug={category.id} varietyId={variety.id} />
        ))}
      </div>
    </section>
  );
};
