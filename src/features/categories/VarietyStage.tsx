import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Send, Sparkles } from 'lucide-react';
import type { Category, SubCategory } from '../../types/category';
import { InteractiveCandleCanvas } from '../../components/canvas/InteractiveCandleCanvas';
import { hasVarietyProducts } from '../../data/catalog';
import { buildVarietyHash } from '../../lib/deepLink';
import { cn } from '../../lib/utils';
import { DESIGN_TOKENS } from '../../theme/designSystem';

/** Props for {@link VarietyStage}. */
export interface VarietyStageProps {
  /** Collection this variety belongs to, for the chrome and the enquiry subject. */
  category: Category;
  /** The variety being shown. */
  variety: SubCategory;
  /** Zero-based position within the collection, rendered one-based. */
  index: number;
  /** How many varieties the collection has. */
  total: number;
  /**
   * Whether to print the collection's `description`.
   *
   * True only for a collection's first variety. The description describes the whole
   * collection, so repeating it on all three of its stages would say the same thing
   * three times — but dropping it entirely would lose copy that has nowhere else to
   * live now that the separate collection screens are gone.
   */
  showCollectionDescription?: boolean;
}

/**
 * One variety's content, as it appears inside its collection's block.
 *
 * Renders the *content layer only*: the lit backdrop belongs to the pinned collection
 * block in `CollectionsJourney`, so it stays put while the varieties cross-fade over it.
 *
 * ## Colour here is ordinary now, and that is a change
 *
 * This file used to be white-and-stone with **no `dark:` counterparts**, documented as a
 * "fixed brand surface" exception, because it sat on a photograph that was dark in both
 * themes. Those photographs are gone — they were 11.39 MB of this route's 11.55 MB — so
 * the exception went with them, and every colour below now carries its dark-mode pair
 * like anywhere else in the project. Do not reintroduce a bare `text-white` here: on a
 * `stone-50` page it is invisible, and that failure is silent.
 *
 * The candle also no longer needs the glass panel it used to sit in. That panel existed
 * only to give `InteractiveCandleCanvas` — whose wick is `bg-stone-800` and whose shadow
 * is a dark radial — a light surface to stand on while the block behind it was dark. On a
 * themed background the canvas is already correct in both modes, so what is left is
 * layout and nothing more.
 */
export const VarietyStage: React.FC<VarietyStageProps> = ({
  category,
  variety,
  index,
  total,
  showCollectionDescription = false,
}) => {
  const stocked = hasVarietyProducts(category.id, variety.id);

  return (
    <div className="grid w-full items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
      <div className="space-y-5">
        {/* No `backdrop-blur` any more: there is no photograph behind this to blur, and
            backdrop filters are the most expensive thing in the stylesheet on a weak GPU. */}
        {/* `amber-800` and not `amber-700` in light mode: measured against this pill's own
            `amber-500/15` fill over `stone-50`, 700 gives 4.32:1 — under the 4.5 AA floor
            for text this size. 800 clears it at ~6:1. */}
        <span className="inline-flex flex-wrap items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/15 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest text-amber-800 dark:text-amber-300">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          {category.title}
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">
            Variety {index + 1} of {total}
          </span>
        </span>

        <h3
          className={cn(DESIGN_TOKENS.typography.panelTitle, 'text-stone-900 dark:text-stone-100')}
        >
          {variety.name}
        </h3>

        {showCollectionDescription && (
          <p className="max-w-xl text-sm font-light leading-relaxed text-stone-600 dark:text-stone-400">
            {category.description}
          </p>
        )}

        <p
          className={cn(
            DESIGN_TOKENS.typography.body,
            'max-w-xl text-stone-600 dark:text-stone-300'
          )}
        >
          {variety.description}
        </p>

        {/* `glass.chip` was `bg-white/10` over a `border-white/20` — correct over a
            photograph, invisible on a `stone-50` page. Real borders instead, the same
            pair `ProductCard`'s scent chips use. */}
        {variety.examples.length > 0 && (
          <ul className="flex flex-wrap gap-2 pt-1">
            {variety.examples.map((example) => (
              <li
                key={example}
                className="rounded-full border border-stone-300/70 bg-white/70 px-3.5 py-1.5 text-xs font-light text-stone-700 dark:border-stone-700 dark:bg-stone-900/70 dark:text-stone-300"
              >
                {example}
              </li>
            ))}
          </ul>
        )}

        {/*
          The CTA tells the truth about what is behind it. Fifteen of the nineteen
          varieties have nothing listed, so a blanket "Explore catalog" would mostly
          lead to a section that isn't there — the same class of dead-but-plausible
          link that `assertCatalogResolves` exists to prevent in the other direction.
        */}
        {stocked ? (
          <Link
            to={{ pathname: '/catalog', hash: buildVarietyHash(category.id, variety.id) }}
            className={cn(
              'group mt-2 inline-flex items-center gap-2.5 rounded-full bg-amber-500 px-7 py-3.5 text-stone-950 shadow-lg transition-colors hover:bg-amber-400',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 dark:focus-visible:ring-offset-stone-950',
              DESIGN_TOKENS.typography.button
            )}
          >
            Explore catalog
            <ArrowRight
              className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1"
              aria-hidden="true"
            />
          </Link>
        ) : (
          <Link
            to="/contact"
            state={{ categoryTitle: `${category.title} — ${variety.name}` }}
            /* `glass.floatingBtn` is dropped along with `border-white/40`: both were
               tuned to read against photography, and its `backdrop-blur-xl` now has
               nothing to blur but costs the same. */
            className={cn(
              'mt-2 inline-flex items-center gap-2.5 rounded-full border border-stone-300 px-7 py-3.5 text-stone-700 transition-colors hover:border-amber-500 hover:text-amber-600',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:text-amber-400 dark:focus-visible:ring-offset-stone-950',
              DESIGN_TOKENS.typography.button
            )}
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            Commission this
          </Link>
        )}
      </div>

      {/* Hidden below `lg`: a 20rem canvas plus the narrative does not fit a phone
          viewport, and the narrative is what matters at that size. */}
      <div className="hidden justify-center p-6 lg:flex">
        <InteractiveCandleCanvas flameIntensity={1} visual={variety.visual} label={variety.name} />
      </div>
    </div>
  );
};
