import React from 'react';
import { Send } from 'lucide-react';
import type { CatalogProduct } from '../../types/catalog';
import { formatPrice } from '../../lib/formatPrice';
import { resolveProductAction, type ProductActionContext } from '../../lib/productActions';
import { cn } from '../../lib/utils';
import { DESIGN_TOKENS } from '../../theme/designSystem';

/** Props for {@link ProductCard}. */
export interface ProductCardProps {
  /** The candle being listed. */
  product: CatalogProduct;
  /** Display titles used in the enquiry message. */
  context: ProductActionContext;
  /**
   * Whether the image should load eagerly. Pass `true` only for the first card or
   * two in a rail — the rest are off-screen horizontally, and eager-loading a
   * whole rail of photography competes with the pinned stage above it for
   * bandwidth on first paint.
   */
  eager?: boolean;
}

/**
 * One candle in a variety's rail: photograph, name, scent chips, price, SKU, and
 * the primary action.
 *
 * ## Why a card here, when the site's rule is "no cards-and-grids for content"
 *
 * That rule protects the *editorial* layer — collections and varieties are told as
 * full-bleed scroll moments so the site doesn't read as a catalogue. A specific
 * purchasable candle is a different kind of content: it has a price and a product
 * code, and a shopper comparing three of them needs them adjacent and uniform.
 * The rule is upheld where it matters by keeping this below the narrative rather
 * than instead of it — the walkthrough is still what introduces the variety.
 *
 * ## The action element
 *
 * The CTA's element is chosen by `resolveProductAction`, not hardcoded. Today's
 * `inquire` intent leaves the site for WhatsApp so it renders an anchor, which is
 * what makes middle-click and "copy link address" work; a future cart action would
 * render a button. See `lib/productActions.ts` for why the dispatcher returns an
 * intent rather than owning the click.
 */
export const ProductCard: React.FC<ProductCardProps> = ({ product, context, eager = false }) => {
  const intent = resolveProductAction(product, 'inquire', context);

  // Shared by both branches below so the two elements are visually identical and
  // only their semantics differ.
  const actionClasses = cn(
    'mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-amber-500 px-5 py-3 text-stone-950 transition-colors hover:bg-amber-400',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 dark:focus-visible:ring-offset-stone-950',
    DESIGN_TOKENS.typography.button
  );

  return (
    <article
      className={cn(
        'flex w-[78vw] shrink-0 snap-start flex-col overflow-hidden rounded-3xl sm:w-[20rem]',
        DESIGN_TOKENS.glass.card
      )}
    >
      <div className="relative aspect-4/5 w-full overflow-hidden bg-stone-100 dark:bg-stone-900">
        <img
          src={product.imageUrl}
          alt={product.name}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          className="h-full w-full object-cover"
        />
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h4 className="text-lg font-light leading-snug tracking-tight text-stone-900 dark:text-stone-100">
          {product.name}
        </h4>

        {product.fragrance.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {product.fragrance.map((note) => (
              <li
                key={note}
                className="rounded-full border border-stone-300/70 bg-white/70 px-2.5 py-1 text-[0.6875rem] font-light text-stone-700 dark:border-stone-700 dark:bg-stone-900/70 dark:text-stone-300"
              >
                {note}
              </li>
            ))}
          </ul>
        )}

        {/* `mt-auto` pins the price row to the bottom so cards of differing name and
            chip heights still line their prices up across the rail. */}
        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <span className="text-xl font-light tabular-nums text-stone-900 dark:text-stone-100">
            {formatPrice(product.priceInr)}
          </span>
          <span className="text-[0.6875rem] font-light uppercase tracking-wider tabular-nums text-stone-500 dark:text-stone-400">
            {product.sku}
          </span>
        </div>

        {intent.kind === 'link' ? (
          <a
            href={intent.href}
            target="_blank"
            rel="noreferrer"
            /* Names the product, because "Commission" repeated down a rail tells a
               screen-reader user nothing about which candle they are on. */
            aria-label={`${intent.label} ${product.name}, ${product.sku}`}
            className={actionClasses}
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            {intent.label}
          </a>
        ) : (
          <button
            type="button"
            onClick={intent.run}
            aria-label={`${intent.label} ${product.name}, ${product.sku}`}
            className={actionClasses}
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            {intent.label}
          </button>
        )}
      </div>
    </article>
  );
};
