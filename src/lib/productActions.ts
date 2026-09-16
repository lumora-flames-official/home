import type { CatalogProduct } from '../types/catalog';
import { buildProductEnquiryMessage, whatsappLink } from '../data/contact';

/**
 * The single dispatch point for "what happens when someone acts on a product
 * card", so the card's markup does not have to change when the answer changes.
 *
 * ## Why this resolves an intent instead of handling a click
 *
 * The obvious shape — `handleProductAction(product, action)` that calls
 * `window.open` — was rejected. Today's action leaves the site for WhatsApp, and
 * `docs/architecture.md#accessibility` requires anything that leaves the site to
 * be a real `<a href>`: only an anchor gives middle-click, long-press and "copy
 * link address" for free, and a `<button onClick>` silently takes all three away.
 * A dispatcher that owns the click therefore *forces* the wrong element.
 *
 * So the dispatcher returns a description of the action and lets the card pick the
 * matching element: an anchor for something that navigates away, a button for
 * something that mutates local state. The accessible element follows from the
 * action's nature rather than being a decision made once and then outgrown.
 *
 * ## Adding the cart later
 *
 * Add `'add_to_cart'` to {@link ProductActionType} and one `case` here returning a
 * `command` intent. {@link ProductActionIntent} already carries that variant and
 * `ProductCard` already renders it, so no component markup and no field in
 * `catalog.json` changes — which is the whole reason the seam exists now rather
 * than being retrofitted around a hardcoded `wa.me` href in the card.
 */

/**
 * Actions a product card can offer.
 *
 * Only `inquire` exists today. `'add_to_cart'` is deliberately *not* pre-declared
 * as a dead branch — an action that resolves to a no-op is worse than an absent
 * one, because it type-checks.
 */
export type ProductActionType = 'inquire';

/** Context a message needs that the product record itself doesn't carry. */
export interface ProductActionContext {
  /** Display title of the collection, e.g. `'Bespoke & Personalized'`. */
  categoryTitle: string;
  /** Display name of the variety, e.g. `'Custom Fragrance Blends'`. */
  varietyName: string;
}

/**
 * What the UI should render for an action.
 *
 * Discriminated on `kind` so the card can switch exhaustively — a new variant
 * becomes a compile error at every render site rather than a silently unhandled
 * case.
 */
export type ProductActionIntent =
  /** Leaves the site. Must be rendered as an `<a href target="_blank" rel="noreferrer">`. */
  | { kind: 'link'; label: string; href: string }
  /**
   * Stays on the page and mutates state. Must be rendered as a `<button>`.
   * Unused until a cart lands; kept in the union so that day touches one file.
   */
  | { kind: 'command'; label: string; run: () => void };

/**
 * Resolves what a product card's primary action should do.
 *
 * @param product The product the card is showing.
 * @param action Which action to resolve. Defaults to `'inquire'`, the only one
 *   currently offered.
 * @param context Display titles for the collection and variety, used in the
 *   enquiry message. Pass the human-readable titles, not id slugs.
 * @returns An intent for the card to render.
 *
 * @example
 * const intent = resolveProductAction(product, 'inquire', { categoryTitle, varietyName });
 */
export const resolveProductAction = (
  product: CatalogProduct,
  action: ProductActionType = 'inquire',
  context: ProductActionContext
): ProductActionIntent => {
  switch (action) {
    case 'inquire':
      return {
        kind: 'link',
        label: 'Commission',
        href: whatsappLink(buildProductEnquiryMessage({ product, ...context })),
      };
  }
};
