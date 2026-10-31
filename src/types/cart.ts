import type { CatalogProduct } from './catalog';

/**
 * Minimal record persisted in `localStorage`. Stores only what cannot be
 * derived from the current catalog: SKU identifies the product, quantity is
 * user intent, and the display titles are needed for the WhatsApp message
 * even if the product is later delisted.
 */
export interface PersistedCartItem {
  sku: string;
  quantity: number;
  categoryTitle: string;
  varietyName: string;
}

/** One line in the cart: a product, how many, and the display titles for the enquiry message. */
export interface CartItem {
  product: CatalogProduct;
  quantity: number;
  /** Human-readable collection title, e.g. `'Bespoke & Personalized'`. */
  categoryTitle: string;
  /** Human-readable variety name, e.g. `'Custom Fragrance Blends'`. */
  varietyName: string;
}
