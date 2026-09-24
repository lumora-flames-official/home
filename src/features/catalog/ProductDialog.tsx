import React, { useEffect, useRef, useState } from 'react';
import { Send, X } from 'lucide-react';
import type { CatalogProduct } from '../../types/catalog';
import { formatPrice } from '../../lib/formatPrice';
import { resolveProductAction, type ProductActionContext } from '../../lib/productActions';
import { cn } from '../../lib/utils';
import { DESIGN_TOKENS } from '../../theme/designSystem';

/**
 * The image viewer: one large frame plus a thumbnail row.
 *
 * Its own component so that `key={product.sku}` resets the selected index by
 * remounting it. The alternative — the dialog holding the index and clearing it when
 * the product changes — means writing state from an effect, which React 19's lint
 * rules reject and which renders the previous candle's fourth photo for one frame.
 */
const ProductGallery: React.FC<{ name: string; urls: string[] }> = ({ name, urls }) => {
  const [active, setActive] = useState(0);

  return (
    <div className="space-y-2 bg-stone-100 p-3 dark:bg-stone-900/60">
      <img
        src={urls[active]}
        alt={urls.length > 1 ? `${name}, photo ${active + 1} of ${urls.length}` : name}
        className="aspect-square w-full rounded-2xl object-cover"
      />

      {/* Only when there is a choice to make. One thumbnail under one photo is a
          control that cannot do anything. */}
      {urls.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {urls.map((url, index) => (
            <li key={url}>
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-current={index === active}
                aria-label={`Show photo ${index + 1}`}
                className={cn(
                  'block h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500',
                  index === active
                    ? 'border-amber-500'
                    : 'border-transparent hover:border-stone-300 dark:hover:border-stone-700'
                )}
              >
                <img src={url} alt="" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/** Props for {@link ProductDialog}. */
export interface ProductDialogProps {
  /** Product to show, or `null` when the dialog should be closed. */
  product: CatalogProduct | null;
  /** Display titles for the enquiry message. */
  context: ProductActionContext;
  /** Called on every dismissal — close button, backdrop, or Escape. */
  onClose: () => void;
}

/**
 * Full detail for one candle: its gallery, notes, price, code and the commission CTA.
 *
 * Exists because the grid tile was doing too much. A tile carrying four scent notes,
 * a product code and a full-width button is tall enough that a phone shows one and a
 * half of them, which is the opposite of what a catalogue is for — the tile should
 * answer "is this the one" at a glance, and everything needed to *act* belongs here.
 *
 * ## Why the native `<dialog>` element
 *
 * `showModal()` supplies the backdrop, the top layer, `Escape` to dismiss, the
 * inertness of everything behind it, and focus containment — all of it, from the
 * platform, correct in every browser the site supports. The hand-rolled equivalent is
 * a portal, a focus trap, an `aria-modal` attribute, a keydown listener and a z-index
 * that eventually loses to something; it is the single most commonly reimplemented
 * thing the platform already ships.
 *
 * Two things still have to be written, and both are here: restoring focus is
 * automatic but *moving* it in is not entirely reliable across engines, and a
 * backdrop click is not a dismissal by default.
 *
 * ## No entrance animation
 *
 * Deliberate, not an omission. A modal is a mode change rather than a reveal, and
 * anything tweened here would need a reduced-motion branch plus a mount/unmount
 * dance to let an exit play — cost with no gain. The house rule that animation is
 * GSAP still holds; there simply is no animation.
 */
export const ProductDialog: React.FC<ProductDialogProps> = ({ product, context, onClose }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  /*
   * Drives the element's modal state from the prop.
   *
   * `showModal()` and `close()` rather than the `open` attribute: the attribute opens
   * a *non-modal* dialog, which has no backdrop, no top layer and no inertness — it is
   * a different widget wearing the same tag name.
   */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (!product) {
      if (dialog.open) dialog.close();
      return;
    }

    if (!dialog.open) dialog.showModal();

    // Focus the dismiss control explicitly. Engines disagree on what receives focus
    // by default, and the gallery thumbnails come first in DOM order — landing on
    // "photo 1 of 4" tells a screen-reader user nothing about what just opened.
    dialog.querySelector<HTMLButtonElement>('[data-dialog-close]')?.focus();
  }, [product]);

  /*
   * A modal dialog makes the page behind it inert but does not reliably stop it
   * scrolling, and this page pages to the next collection when scrolled past its
   * end — so without this, spinning the wheel over the backdrop would change the
   * collection underneath the open dialog. `CatalogPage` also disables its
   * over-scroll pager while this is open; that is the belt, and this is the braces.
   */
  useEffect(() => {
    if (!product) return;

    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';

    return () => {
      body.style.overflow = previousOverflow;
    };
  }, [product]);

  /*
   * Rendered even when closed so the element exists for `showModal()` to be called
   * on. Returning `null` for a missing product would mean the ref is empty on the
   * very render that wants to open it.
   */
  const intent = product ? resolveProductAction(product, 'inquire', context) : null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="product-dialog-title"
      // `close` fires for Escape too, which is the only notification of that dismissal.
      onClose={onClose}
      // The backdrop is painted by the dialog itself, so a click that lands on the
      // element rather than on any child *is* a backdrop click.
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      className={cn(
        'm-auto w-[min(60rem,calc(100vw-2rem))] max-h-[min(44rem,calc(100dvh-2rem))] overflow-y-auto rounded-3xl p-0',
        'backdrop:bg-stone-950/70 backdrop:backdrop-blur-sm',
        'bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100'
      )}
    >
      {product && intent && (
        <div className="grid gap-0 sm:grid-cols-2">
          {/* `key` remounts the gallery when a different product opens, so the second
              candle never starts on the fourth photo of the first. */}
          <ProductGallery key={product.sku} name={product.name} urls={product.imageUrls} />

          <div className="flex flex-col gap-5 p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-1.5">
                <span className={DESIGN_TOKENS.typography.eyebrow}>
                  {context.categoryTitle} · {context.varietyName}
                </span>
                <h2
                  id="product-dialog-title"
                  className="text-2xl font-light leading-snug tracking-tight sm:text-3xl"
                >
                  {product.name}
                </h2>
              </div>

              <button
                type="button"
                data-dialog-close
                onClick={onClose}
                aria-label="Close"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-stone-300 text-stone-600 transition-colors hover:border-amber-500 hover:text-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-stone-700 dark:text-stone-400"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="text-3xl font-light tabular-nums">
                {formatPrice(product.priceInr)}
              </span>
              <span className="text-xs font-light uppercase tracking-wider tabular-nums text-stone-500 dark:text-stone-400">
                {product.sku}
              </span>
            </div>

            {product.fragrance.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  Fragrance
                </h3>
                <ul className="flex flex-wrap gap-1.5">
                  {product.fragrance.map((note) => (
                    <li
                      key={note}
                      className="rounded-full border border-stone-300/70 bg-white/70 px-3 py-1.5 text-xs font-light dark:border-stone-700 dark:bg-stone-900/70"
                    >
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className={cn(DESIGN_TOKENS.typography.body, 'text-stone-600 dark:text-stone-400')}>
              Poured to order. Quote the product code when you message us and we&apos;ll confirm
              availability, quantity and lead time.
            </p>

            {/* `mt-auto` keeps the action on the panel's bottom edge whatever the notes
                above it add up to, so it is in the same place for every candle. */}
            <div className="mt-auto">
              {intent.kind === 'link' ? (
                <a
                  href={intent.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${intent.label} ${product.name}, ${product.sku}`}
                  className={cn(
                    'inline-flex w-full items-center justify-center gap-2 rounded-full bg-amber-500 px-6 py-3.5 text-stone-950 transition-colors hover:bg-amber-400',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 dark:focus-visible:ring-offset-stone-950',
                    DESIGN_TOKENS.typography.button
                  )}
                >
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  {intent.label} this candle
                </a>
              ) : (
                <button
                  type="button"
                  onClick={intent.run}
                  className={cn(
                    'inline-flex w-full items-center justify-center gap-2 rounded-full bg-amber-500 px-6 py-3.5 text-stone-950 transition-colors hover:bg-amber-400',
                    DESIGN_TOKENS.typography.button
                  )}
                >
                  {intent.label}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
};
