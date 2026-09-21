import { describe, it, expect } from 'vitest';
import { CANDLE_CATEGORIES } from '../data/categories';
import { buildVarietyHash, parseCollectionHash, parseVarietyHash } from './deepLink';

/**
 * These exist for the same reason `contact.test.ts` does: the failure is *silent*.
 *
 * A hash that no longer resolves does not throw and does not show an error — the
 * reader simply lands at the top of the page, which is indistinguishable from having
 * clicked a link that was always meant to go there. `/collections` and `/catalog` link
 * into each other's scroll positions using this format, so a drift between building
 * and parsing breaks the round-trip invisibly, in both directions at once.
 */

/** A real pair, taken from the dataset rather than hardcoded so a rename can't stale it. */
const CATEGORY = CANDLE_CATEGORIES[3];
const VARIETY = CATEGORY.subCategories[1];

describe('variety deep links', () => {
  it('round-trips every variety in the dataset', () => {
    // All 19, because the parser validates against the tree and a structural change
    // (a renamed id, a reordered collection) should fail here rather than in a click.
    for (const category of CANDLE_CATEGORIES) {
      for (const variety of category.subCategories) {
        expect(parseVarietyHash(buildVarietyHash(category.id, variety.id))).toEqual({
          categoryId: category.id,
          varietyId: variety.id,
        });
      }
    }
  });

  it('accepts a hash with or without the leading #', () => {
    const withHash = buildVarietyHash(CATEGORY.id, VARIETY.id);

    expect(withHash.startsWith('#')).toBe(true);
    expect(parseVarietyHash(withHash)).toEqual(parseVarietyHash(withHash.slice(1)));
  });

  it('returns null for anything that does not name a real variety', () => {
    expect(parseVarietyHash('')).toBeNull();
    expect(parseVarietyHash('#')).toBeNull();
    // Well-formed but stale — the case that would otherwise fail silently.
    expect(parseVarietyHash('#no-such-collection/no-such-variety')).toBeNull();
    // Real collection, real variety, but the variety belongs to a different collection.
    expect(
      parseVarietyHash(`#${CATEGORY.id}/${CANDLE_CATEGORIES[0].subCategories[0].id}`)
    ).toBeNull();
    // Collection alone is not a variety target; `parseCollectionHash` handles that.
    expect(parseVarietyHash(`#${CATEGORY.id}`)).toBeNull();
    expect(parseVarietyHash(`#${CATEGORY.id}/${VARIETY.id}/extra`)).toBeNull();
  });
});

describe('collection deep links', () => {
  it('falls back to a collection first variety', () => {
    for (const category of CANDLE_CATEGORIES) {
      expect(parseCollectionHash(`#${category.id}`)).toEqual({
        categoryId: category.id,
        varietyId: category.subCategories[0].id,
      });
    }
  });

  it('still resolves a full variety hash', () => {
    expect(parseCollectionHash(buildVarietyHash(CATEGORY.id, VARIETY.id))).toEqual({
      categoryId: CATEGORY.id,
      varietyId: VARIETY.id,
    });
  });

  it('returns null for an unknown collection', () => {
    expect(parseCollectionHash('#nope')).toBeNull();
    expect(parseCollectionHash('')).toBeNull();
  });
});
