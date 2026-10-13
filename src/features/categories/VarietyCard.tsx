import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Send, Sparkles } from 'lucide-react';
import type { Category, SubCategory } from '../../types/category';
import { hasVarietyProducts } from '../../data/catalog';
import { buildVarietyHash } from '../../lib/deepLink';
import { cn } from '../../lib/utils';
import { DESIGN_TOKENS } from '../../theme/designSystem';

/** Props for {@link VarietyCard}. */
export interface VarietyCardProps {
  category: Category;
  variety: SubCategory;
  index: number;
  total: number;
}

/**
 * Compact variety card for the mobile horizontal-scroll layout.
 *
 * No GSAP, no animation, no backdrop-blur — designed for zero JS cost on
 * low-end mobile hardware. Scent chips are capped at three so the card
 * stays a consistent height across varieties with different example counts.
 */
export const VarietyCard: React.FC<VarietyCardProps> = ({ category, variety, index, total }) => {
  const stocked = hasVarietyProducts(category.id, variety.id);
  const visibleExamples = variety.examples.slice(0, 3);
  const overflow = variety.examples.length - visibleExamples.length;

  return (
    <article
      className={cn(
        'flex w-64 shrink-0 snap-start flex-col justify-between rounded-2xl border p-5',
        'border-stone-200/80 bg-white/80 dark:border-stone-800/80 dark:bg-stone-900/60'
      )}
    >
      <div className="space-y-3">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-400">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          {index + 1} / {total}
        </span>

        <h4
          className={cn(
            DESIGN_TOKENS.typography.sectionTitle,
            'text-stone-900 dark:text-stone-100'
          )}
        >
          {variety.name}
        </h4>

        <p className="line-clamp-3 text-sm font-light leading-relaxed text-stone-600 dark:text-stone-400">
          {variety.description}
        </p>

        {visibleExamples.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {visibleExamples.map((example) => (
              <li
                key={example}
                className="rounded-full border border-stone-300/70 bg-white/70 px-2.5 py-1 text-[10px] font-light text-stone-700 dark:border-stone-700 dark:bg-stone-900/70 dark:text-stone-300"
              >
                {example}
              </li>
            ))}
            {overflow > 0 && (
              <li className="rounded-full border border-stone-300/70 bg-white/70 px-2.5 py-1 text-[10px] font-light text-stone-500 dark:border-stone-700 dark:bg-stone-900/70 dark:text-stone-400">
                +{overflow} more
              </li>
            )}
          </ul>
        )}
      </div>

      {stocked ? (
        <Link
          to={{ pathname: '/catalog', hash: buildVarietyHash(category.id, variety.id) }}
          className={cn(
            'mt-4 inline-flex items-center gap-2 rounded-full bg-amber-500 px-5 py-2.5 text-stone-950 transition-colors hover:bg-amber-400',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-stone-900',
            DESIGN_TOKENS.typography.button
          )}
        >
          Catalog
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      ) : (
        <Link
          to="/contact"
          state={{ categoryTitle: `${category.title} — ${variety.name}` }}
          className={cn(
            'mt-4 inline-flex items-center gap-2 rounded-full border border-stone-300 px-5 py-2.5 text-stone-700 transition-colors hover:border-amber-500 hover:text-amber-600',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-stone-700 dark:text-stone-300 dark:hover:text-amber-400 dark:focus-visible:ring-offset-stone-900',
            DESIGN_TOKENS.typography.button
          )}
        >
          <Send className="h-3 w-3" aria-hidden="true" />
          Commission
        </Link>
      )}
    </article>
  );
};
