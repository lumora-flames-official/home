/**
 * Shapes for the product catalog — the individual candles listed beneath each
 * variety on `/category/:categoryId`.
 *
 * This is the first dataset in the project that is *written by tooling* rather
 * than hand-authored: the local-only CMS at `/update-list` appends to
 * `src/data/catalog.json` through the dev-server middleware in
 * `scripts/catalogDevApi.ts`. So these types are the contract between the writer
 * and the reader, and both sides import them.
 */

/**
 * One candle exactly as it is stored in `catalog.json`.
 *
 * Deliberately *not* self-describing about where it sits: `categoryId` and
 * `varietyId` are the JSON keys above it, not fields on the record. Storing them
 * again would create two definitions of the same truth, and the day they
 * disagree the product renders under one variety while linking to another.
 * {@link CatalogProduct} attaches them on load instead.
 */
export interface StoredProduct {
  /**
   * Stable public identifier, e.g. `BESPOKE-V1-01`. Generated once by the CMS
   * and then **never recomputed** — it appears in WhatsApp enquiries the studio
   * has already received, so it must survive a collection being reordered.
   */
  sku: string;
  /** Display name, e.g. `Amber Glow Jar`. */
  name: string;
  /**
   * Price in whole rupees.
   *
   * A number and not a display string like `"₹1,200"` because a cart has to sum
   * line items, and summing formatted strings means parsing the currency glyph
   * and thousands separators back off. Render it through `formatPrice`.
   */
  priceInr: number;
  /** Scent notes, rendered as chips, e.g. `['Vanilla', 'Cedarwood']`. */
  fragrance: string[];
  /**
   * Image **filename only**, e.g. `amber-glow.jpg`.
   *
   * The directory is derived as `catalog-images/<categoryId>/` from the key this
   * record sits under, for the same reason `categoryId` is not a field here.
   */
  image: string;
}

/**
 * The whole on-disk dataset: category id → variety id → products.
 *
 * Keyed by the real ids from `CANDLE_CATEGORIES`, not by position. Positional
 * keys (`variety_1`, `variety_2`, …) were the obvious alternative and are a trap:
 * reordering a collection's `subCategories` would silently repoint every product
 * beneath it at a different variety, with nothing to validate against. Real ids
 * are checked by `assertCatalogResolves()` on import.
 */
export type CatalogData = Record<string, Record<string, StoredProduct[]>>;

/**
 * A product as the UI consumes it: the stored record plus the context that was
 * implicit in its position, and a real resolved image URL.
 *
 * The extra fields are what make a cart droppable in later without a schema
 * change — a line item needs to know its own category and variety once it has
 * been lifted out of the nested map.
 */
export interface CatalogProduct extends StoredProduct {
  /** Owning collection id, from the map key. */
  categoryId: string;
  /** Owning variety id, from the map key. */
  varietyId: string;
  /**
   * Build-time-resolved, content-hashed URL from `catalogImages`.
   *
   * Never a `/catalog/...` string path: the site deploys under a base prefix
   * (`/lumora_flames/`, and `/lumora_flames/pr-N/` for previews), so a
   * root-relative literal resolves above the deploy root and 404s in production
   * while working perfectly in dev.
   */
  imageUrl: string;
}
