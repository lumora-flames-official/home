import type { CatalogProduct } from './catalog';

/** One line in the cart: a product, how many, and the display titles for the enquiry message. */
export interface CartItem {
  product: CatalogProduct;
  quantity: number;
  /** Human-readable collection title, e.g. `'Bespoke & Personalized'`. */
  categoryTitle: string;
  /** Human-readable variety name, e.g. `'Custom Fragrance Blends'`. */
  varietyName: string;
}
