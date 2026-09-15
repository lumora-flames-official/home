/**
 * SKU minting for catalog products.
 *
 * Lives in `lib/` as pure functions because two very different callers need to
 * agree on the format: the browser-side CMS panel (to preview the code before
 * saving) and the dev-server middleware in `scripts/catalogDevApi.ts` (which
 * actually assigns it). The middleware reaches this through Vite's
 * `ssrLoadModule`, so there is one definition rather than a Node copy that
 * eventually drifts from the browser one.
 */

/**
 * Leading word of a collection id, uppercased — the human-readable half of a SKU.
 *
 * The first segment happens to be unique across all six collections (`BESPOKE`,
 * `CONTAINER`, `SCULPTURAL`, `TRADITIONAL`, `SPECIALTY`, `RAW`), which is why the
 * whole id isn't used: `BESPOKE-PERSONALIZED-V1-01` is not more informative, just
 * longer, and a SKU gets typed into WhatsApp messages by hand.
 *
 * A future seventh collection whose first word collides would need a real token
 * map here; `assertCatalogResolves` catches the resulting duplicate SKUs.
 */
export const skuCategoryToken = (categoryId: string): string =>
  categoryId.split('-')[0].toUpperCase();

/**
 * Builds a product code, e.g. `BESPOKE-V1-01`.
 *
 * @param categoryId Owning collection id, e.g. `bespoke-personalized`.
 * @param varietyIndex Zero-based position of the variety within that collection.
 *   Rendered one-based, so the first variety is `V1`.
 * @param sequence One-based number of this product within the variety.
 * @returns The formatted SKU.
 *
 * @remarks
 * A SKU is *minted*, not derived. Once assigned it is stored verbatim in
 * `catalog.json` and never recomputed, because it has already been quoted in
 * enquiries — recomputing would silently renumber live product codes the moment
 * a collection's varieties were reordered or an earlier item deleted.
 */
export const buildSku = (categoryId: string, varietyIndex: number, sequence: number): string =>
  `${skuCategoryToken(categoryId)}-V${varietyIndex + 1}-${String(sequence).padStart(2, '0')}`;

/**
 * Picks the next free sequence number for a variety.
 *
 * @param existingSkus SKUs already present in that variety.
 * @returns One past the highest sequence seen, or `1` for an empty variety.
 *
 * @remarks
 * Deliberately `max + 1` and not `length + 1`. With three products and the middle
 * one deleted, `length + 1` yields `03` — which the surviving third product
 * already owns. That collision would be caught by `assertCatalogResolves`, but
 * only after it had been written to disk.
 */
export const nextSkuSequence = (existingSkus: readonly string[]): number => {
  const highest = existingSkus.reduce((max, sku) => {
    // Trailing digit group is the sequence; anything else is a hand-edited SKU
    // we should step over rather than fail on.
    const parsed = Number(/-(\d+)$/.exec(sku)?.[1]);
    return Number.isFinite(parsed) && parsed > max ? parsed : max;
  }, 0);

  return highest + 1;
};
