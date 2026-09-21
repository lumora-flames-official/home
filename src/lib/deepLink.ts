import { CANDLE_CATEGORIES } from '../data/categories';

/**
 * The one definition of how a collection + variety is addressed in a URL.
 *
 * `/collections` and `/catalog` both scroll to a variety named in the URL, and each
 * links into the other at the reader's current position. If they disagreed about the
 * format by a character, the round-trip would silently land at the top of the page —
 * so the format lives here and both import it.
 *
 * ## Why the hash and not a path segment
 *
 * `/collections/specialty-wax` was the obvious shape and is unusable. `PageTransition`
 * scrolls to top and replays its enter tween on every `pathname` change, so a tab
 * that navigated to a path would reset the scroll it was supposed to move — the exact
 * opposite of jumping to a collection. A hash change leaves `pathname` untouched, so
 * the transition never fires, while still being shareable and surviving a reload.
 *
 * ## Why a pair and not just the variety id
 *
 * All 19 variety ids happen to be unique across the dataset today, so `#urli-diya`
 * would resolve. Nothing enforces that: two collections are free to both contain a
 * `wax`, and on the day they do, every affected link would quietly resolve to
 * whichever came first. The pair costs a few characters and cannot go wrong.
 */

/** A resolved deep-link target. Both ids are guaranteed to exist. */
export interface VarietyTarget {
  categoryId: string;
  varietyId: string;
}

/**
 * Builds the hash addressing one variety.
 *
 * @param categoryId Collection id from `CANDLE_CATEGORIES`.
 * @param varietyId Sub-category id within it.
 * @returns e.g. `#traditional-festive/urli-diya`, including the leading `#` so it can
 *   be handed straight to a `<Link to>` or assigned to `location.hash`.
 *
 * @example
 * <Link to={{ pathname: '/catalog', hash: buildVarietyHash(c.id, v.id) }}>
 */
export const buildVarietyHash = (categoryId: string, varietyId: string): string =>
  `#${categoryId}/${varietyId}`;

/**
 * Resolves a hash back to a target, or `null` if it names nothing real.
 *
 * Validates against `CANDLE_CATEGORIES` rather than merely splitting on `/`, for the
 * same reason `assertTargetsResolve` exists in `promotions.ts`: an unrecognised id
 * does not throw anywhere, it just fails to match a section, and the reader lands at
 * the top of the page with no indication that the link they followed was stale. A
 * `null` return lets the caller treat "no target" and "bad target" identically, which
 * is the right behaviour — both mean "start at the top".
 *
 * @param hash `location.hash`, with or without the leading `#`. Empty is valid input
 *   and yields `null`.
 * @returns The target, or `null`.
 */
export const parseVarietyHash = (hash: string): VarietyTarget | null => {
  const [categoryId, varietyId, ...extra] = decodeURIComponent(hash.replace(/^#/, '')).split('/');

  // A third segment means the link was built by something that doesn't share this
  // module's format; refusing it is better than guessing which parts to keep.
  if (!categoryId || !varietyId || extra.length > 0) return null;

  const category = CANDLE_CATEGORIES.find((candidate) => candidate.id === categoryId);
  if (!category) return null;

  return category.subCategories.some((variety) => variety.id === varietyId)
    ? { categoryId, varietyId }
    : null;
};

/**
 * Resolves a hash that may name only a collection, e.g. `#raw-materials`.
 *
 * This is the shape `/category/:categoryId` redirects to and the shape the collection
 * tabs use, since a tab addresses a whole collection rather than one variety. Falls
 * back to the collection's first variety so callers only ever handle a full target.
 *
 * @param hash `location.hash`, with or without the leading `#`.
 * @returns A full target, or `null` if the hash names no known collection.
 */
export const parseCollectionHash = (hash: string): VarietyTarget | null => {
  const full = parseVarietyHash(hash);
  if (full) return full;

  const categoryId = decodeURIComponent(hash.replace(/^#/, ''));
  const category = CANDLE_CATEGORIES.find((candidate) => candidate.id === categoryId);
  const firstVariety = category?.subCategories[0];

  return category && firstVariety ? { categoryId: category.id, varietyId: firstVariety.id } : null;
};
