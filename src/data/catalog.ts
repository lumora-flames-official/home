import type { CatalogData, CatalogProduct, StoredProduct } from '../types/catalog';
import { CANDLE_CATEGORIES } from './categories';
import { catalogImageUrl } from './catalogImages';
import catalogJson from './catalog.json';

/**
 * The product catalog — individual candles, listed beneath their variety on
 * `/catalog`.
 *
 * This is the one dataset in the project that is written by tooling instead of by
 * hand: the local-only CMS at `/update-list` posts to the dev-server middleware
 * in `scripts/catalogDevApi.ts`, which appends to `catalog.json` and drops the
 * photo into `catalog-images/`. Publishing is then a normal commit — the content
 * is still compiled into the bundle, so there is no runtime fetch and no backend,
 * which is the constraint `docs/architecture.md` asks new content to respect.
 *
 * Being machine-written is precisely why `assertCatalogResolves()` at the bottom
 * is not optional. Hand-authored data gets reviewed in a diff; this does not.
 */

/**
 * `catalog.json` starts life as `{}` and TypeScript infers that literally, giving
 * an empty object type with no index signature. The cast restores the real shape.
 *
 * It is a genuine cast and not a validation: the file's contents are only as
 * trustworthy as the middleware that wrote them, which is what the assertion
 * below exists to check.
 */
const CATALOG = catalogJson as CatalogData;

/** Empty array shared by every miss, so a lookup never allocates. */
const NONE: readonly CatalogProduct[] = [];

/**
 * Attaches the context that was implicit in a product's position in the map, plus
 * its resolved image URL.
 *
 * @param stored Record as it sits in `catalog.json`.
 * @param categoryId Key it was filed under.
 * @param varietyId Sub-key it was filed under.
 */
const hydrate = (stored: StoredProduct, categoryId: string, varietyId: string): CatalogProduct => ({
  ...stored,
  categoryId,
  varietyId,
  // `?? ''` cannot happen in a checked build — assertCatalogResolves throws on a
  // missing file in dev, and a production build was necessarily preceded by one.
  // An empty src degrades to a blank frame rather than a crashed rail.
  imageUrl: catalogImageUrl(categoryId, stored.image) ?? '',
});

/**
 * Products listed under one variety, in authoring order.
 *
 * @param categoryId Collection id from `CANDLE_CATEGORIES`.
 * @param varietyId Sub-category id within it.
 * @returns Hydrated products, or an empty array when nothing is listed yet —
 *   which is the normal case for a variety awaiting photography, and callers are
 *   expected to render nothing rather than an empty state.
 *
 * @example
 * getVarietyProducts('bespoke-personalized', 'custom-fragrance-blends')
 */
export const getVarietyProducts = (
  categoryId: string,
  varietyId: string
): readonly CatalogProduct[] => {
  const stored = CATALOG[categoryId]?.[varietyId];
  if (!stored || stored.length === 0) return NONE;

  return stored.map((product) => hydrate(product, categoryId, varietyId));
};

/**
 * How many products a whole collection lists, across every variety.
 *
 * Exists so a caller can decide whether to render the catalog section at all
 * without hydrating (and discarding) every product to find out.
 *
 * @param categoryId Collection id.
 */
export const countCollectionProducts = (categoryId: string): number =>
  Object.values(CATALOG[categoryId] ?? {}).reduce((total, list) => total + list.length, 0);

/**
 * Whether a variety has anything listed.
 *
 * Drives the collections journey's CTA, which has to be honest: a variety with stock
 * offers "Explore catalog", and one without offers "Commission this" instead of
 * sending the reader to a catalog section that does not exist. Most varieties are
 * empty, so this is the common case rather than an edge one.
 *
 * @param categoryId Collection id.
 * @param varietyId Sub-category id within it.
 */
export const hasVarietyProducts = (categoryId: string, varietyId: string): boolean =>
  (CATALOG[categoryId]?.[varietyId]?.length ?? 0) > 0;

/** One variety's products, with the display titles the catalog page needs. */
export interface CatalogGroup {
  categoryId: string;
  categoryTitle: string;
  varietyId: string;
  varietyName: string;
  products: readonly CatalogProduct[];
}

/**
 * Every **stocked** variety, in `CANDLE_CATEGORIES` order — the catalog page's spine.
 *
 * Iterates the category tree rather than `Object.entries(CATALOG)` so the ordering is
 * the canonical one a reader already saw in the journey, not JSON key insertion order,
 * which reflects nothing more than which product the studio happened to add first.
 *
 * Empty varieties are omitted rather than returned with an empty `products` array.
 * That is the user-facing decision: with four products across nineteen varieties, a
 * page listing them all would be fifteen "coming soon" panels, which reads as a broken
 * shop. Callers that need to know about an empty variety ask `hasVarietyProducts`.
 */
export const getCatalogGroups = (): CatalogGroup[] =>
  CANDLE_CATEGORIES.flatMap((category) =>
    category.subCategories
      .map((variety) => ({
        categoryId: category.id,
        categoryTitle: category.title,
        varietyId: variety.id,
        varietyName: variety.name,
        products: getVarietyProducts(category.id, variety.id),
      }))
      .filter((group) => group.products.length > 0)
  );

/* -------------------------------------------------------------------------- */
/* Development-time integrity check                                            */
/* -------------------------------------------------------------------------- */

/**
 * Fails loudly in development when the catalog references something that does not
 * exist.
 *
 * Modelled on `assertTargetsResolve()` in `promotions.ts`, and here for a sharper
 * version of the same reason: every failure mode this catches is *invisible*.
 *
 * - An unknown `categoryId` or `varietyId` key means the products under it are
 *   simply never looked up. No error, no empty state — the rail is absent, which
 *   is indistinguishable from a variety with nothing listed yet.
 * - A missing image file yields a broken `<img>`, so the card renders with a
 *   name, a price and a hole where the candle should be.
 * - A duplicate SKU means two different candles answer to one product code, and
 *   the studio finds out when an enquiry names the wrong one.
 *
 * Dev-only and throwing, matching the existing precedent: production ships
 * nothing, and in dev a broken catalog should stop you rather than be something
 * you notice later in a screenshot.
 */
function assertCatalogResolves(): void {
  const varietiesByCategory = new Map(
    CANDLE_CATEGORIES.map((category) => [
      category.id,
      new Set(category.subCategories.map((variety) => variety.id)),
    ])
  );

  const problems: string[] = [];
  const seenSkus = new Map<string, string>();

  for (const [categoryId, varieties] of Object.entries(CATALOG)) {
    const known = varietiesByCategory.get(categoryId);

    if (!known) {
      problems.push(
        `• unknown collection "${categoryId}" — valid ids: ${[...varietiesByCategory.keys()].join(', ')}`
      );
      continue;
    }

    for (const [varietyId, products] of Object.entries(varieties)) {
      if (!known.has(varietyId)) {
        problems.push(
          `• "${categoryId}" has no variety "${varietyId}" — valid ids: ${[...known].join(', ')}`
        );
        continue;
      }

      for (const product of products) {
        if (!catalogImageUrl(categoryId, product.image)) {
          problems.push(
            `• ${product.sku}: image not on disk — expected src/data/catalog-images/${categoryId}/${product.image}`
          );
        }

        const owner = seenSkus.get(product.sku);
        if (owner) {
          problems.push(`• duplicate SKU ${product.sku} — already used by ${owner}`);
        } else {
          seenSkus.set(product.sku, `${categoryId}/${varietyId}`);
        }
      }
    }
  }

  if (problems.length === 0) return;

  throw new Error(
    `[catalog] ${problems.length} problem(s) in src/data/catalog.json:\n${problems.join('\n')}\n\n` +
      'Fix catalog.json, not CANDLE_CATEGORIES — collection and variety ids are URL slugs, ' +
      'and renaming one breaks live links. Products are normally added through /update-list, ' +
      'whose selects only offer valid ids.'
  );
}

if (import.meta.env.DEV) assertCatalogResolves();
