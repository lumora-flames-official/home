import React from 'react';
import { ImageIcon } from 'lucide-react';
import type { CatalogProduct } from '../../types/catalog';
import { formatPrice } from '../../lib/formatPrice';
import { cn } from '../../lib/utils';
import { DESIGN_TOKENS } from '../../theme/designSystem';

/** Props for {@link ProductCard}. */
export interface ProductCardProps {
  /** The candle being listed. */
  product: CatalogProduct;
  /** Opens the detail dialog for this candle. */
  onOpen: (product: CatalogProduct) => void;
  /**
   * Whether the image should load eagerly. Pass `true` only for the first row of a
   * grid — everything below the fold competes with it for bandwidth on first paint.
   */
  eager?: boolean;
}

/**
 * One candle in the catalog grid: photograph, name, price, and nothing else.
 *
 * ## Why so little is on the tile
 *
 * It used to carry every scent note, the product code and a full-width CTA. At that
 * height a phone showed one and a half tiles, which inverts what a catalogue is for —
 * scanning. A tile has one job: let someone decide whether to look closer. Everything
 * needed to *act* moved into `ProductDialog`, which the whole tile opens.
 *
 * ## Why a button and not a link
 *
 * There is no URL for a single product — `docs/architecture.md` has the catalog group
 * as the deepest addressable view, and the dialog is a mode on the current page rather
 * than a destination. A `<button>` is therefore the honest element: an anchor to `#`
 * would promise a shareable address that does not exist, and offering middle-click and
 * "copy link address" on something that cannot be opened in a new tab is worse than
 * not offering them. The commission link *inside* the dialog does leave the site, and
 * is an anchor accordingly.
 *
 * ## Why a card here, when the site's rule is "no cards-and-grids for content"
 *
 * That rule protects the *editorial* layer — collections and varieties are told as
 * full-bleed scroll moments so the site doesn't read as a catalogue. A specific
 * purchasable candle is a different kind of content: it has a price and a product
 * code, and a shopper comparing three of them needs them adjacent and uniform.
 */
export const ProductCard: React.FC<ProductCardProps> = ({ product, onOpen, eager = false }) => {
  const extraShots = product.imageUrls.length - 1;

  return (
    <button
      type="button"
      onClick={() => onOpen(product)}
      // The visible text is a name and a price; on its own that does not say that
      // activating this opens anything.
      aria-label={`${product.name}, ${formatPrice(product.priceInr)} — view details`}
      className={cn(
        'group flex flex-col overflow-hidden rounded-2xl text-left transition-colors hover:border-amber-500/60',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 dark:focus-visible:ring-offset-stone-950',
        DESIGN_TOKENS.glass.card
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-stone-100 dark:bg-stone-900">
        <img
          src={product.imageUrl}
          alt={product.name}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          /* Scale rather than any layout property, per the motion rules. The parent's
             `overflow-hidden` is what turns it into a crop instead of an overhang. */
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Signals that the dialog has more to show. Absent for a single-photo
            listing, because a badge reading "1" is noise. */}
        {extraShots > 0 && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-stone-950/70 px-2 py-1 text-[0.625rem] font-semibold tabular-nums text-white backdrop-blur-sm">
            <ImageIcon className="h-2.5 w-2.5" aria-hidden="true" />+{extraShots}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        {/* Clamped, not truncated: real names run to "Motichoor Ladoo Candle Box
            (Pack of 4)", and one ellipsised line of that identifies nothing. */}
        <h4 className="line-clamp-2 text-sm font-light leading-snug tracking-tight">
          {product.name}
        </h4>
        <span className="mt-auto text-base font-light tabular-nums">
          {formatPrice(product.priceInr)}
        </span>
      </div>
    </button>
  );
};
