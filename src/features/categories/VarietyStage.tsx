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
 * One variety's content, as it appears over its collection's photograph.
 *
 * Renders the *content layer only*: the photograph belongs to the pinned collection
 * block in `CollectionsJourney`, so it stays put while the varieties cross-fade over
 * it. Giving each variety its own copy of the image would restart the same photograph
 * three times per collection.
 *
 * ## Colour on a fixed surface
 *
 * The text here sits on a scrimmed photograph, which is dark in *both* themes, so the
 * copy is white and stone with **no `dark:` counterparts**. That is the documented
 * exception to the every-colour-needs-a-dark-variant rule — a fixed brand surface —
 * and it is called out here so the next reader doesn't "fix" it into unreadability.
 *
 * ## Why the candle sits in a glass panel
 *
 * `InteractiveCandleCanvas` styles itself for a light surface in light mode: its wick
 * is `bg-stone-800`, its shadow a dark radial. Dropped straight onto a dark photograph
 * it would be dark-on-dark in light mode and invisible. `DESIGN_TOKENS.glass.card` is
 * light in light mode and dark in dark mode, so the panel gives the canvas the surface
 * it expects in each theme — without forcing a `.dark` class onto a subtree, which
 * would lie to every other component inside it.
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
        <span className="inline-flex flex-wrap items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/20 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest text-amber-300 backdrop-blur-md">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          {category.title}
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">
            Variety {index + 1} of {total}
          </span>
        </span>

        <h3 className={cn(DESIGN_TOKENS.typography.panelTitle, 'text-white')}>{variety.name}</h3>

        {showCollectionDescription && (
          <p className="max-w-xl text-sm font-light leading-relaxed text-stone-300">
            {category.description}
          </p>
        )}

        <p className={cn(DESIGN_TOKENS.typography.body, 'max-w-xl text-stone-200')}>
          {variety.description}
        </p>

        {variety.examples.length > 0 && (
          <ul className="flex flex-wrap gap-2 pt-1">
            {variety.examples.map((example) => (
              <li
                key={example}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-xs font-light text-white',
                  DESIGN_TOKENS.glass.chip
                )}
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
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950',
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
            className={cn(
              'mt-2 inline-flex items-center gap-2.5 rounded-full border border-white/40 px-7 py-3.5 text-white transition-colors hover:bg-white/20',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950',
              DESIGN_TOKENS.glass.floatingBtn,
              DESIGN_TOKENS.typography.button
            )}
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            Commission this
          </Link>
        )}
      </div>

      {/* Hidden below `lg`: the photograph is already carrying the visual weight on a
          phone, and a 20rem canvas plus the narrative does not fit a viewport. */}
      <div
        className={cn('hidden justify-center rounded-3xl p-6 lg:flex', DESIGN_TOKENS.glass.card)}
      >
        <InteractiveCandleCanvas flameIntensity={1} visual={variety.visual} label={variety.name} />
      </div>
    </div>
  );
};
