import { CANDLE_CATEGORIES } from './categories';
import { ASSET_IMAGES } from './assets';
import type { GiftingSlide, PromoSlide, ReasonSlide } from '../types/promotion';

/**
 * Content for the home page's three promotional placements.
 *
 * Data lives here rather than inside the carousel components, mirroring how
 * `categories.ts` works: a template that can't render an arbitrary array is a
 * bug, and a component that hardcodes its own copy can't be reused.
 *
 * To run a seasonal campaign, edit the copy in this file. Nothing else needs to
 * change.
 */

/* -------------------------------------------------------------------------- */
/* Placement 1 — Offers                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Reasons to act now, as editorial urgency rather than discount percentages.
 *
 * There is no pricing model anywhere in this codebase, and a luxury brand that
 * shouts "40% OFF" stops reading as one. Scarcity and lead time do the same job
 * without a number that can go stale or contradict what the concierge quotes.
 */
export const OFFER_SLIDES: PromoSlide[] = [
  {
    id: 'festive-edit',
    tagline: 'Limited Seasonal Pour',
    title: 'The festive edit,',
    highlightText: 'while it lasts',
    description:
      'Brass urlis and floral diyas are poured in small batches for the season. When a batch is gone, it is not repoured.',
    bgImage: ASSET_IMAGES.promotional_one.first,
    ctaText: 'See the festive edit',
    targetCollectionId: 'traditional-festive',
  },
  {
    id: 'bespoke-leadtime',
    tagline: 'Concierge Commissions',
    title: 'Bespoke blends take',
    highlightText: 'three weeks',
    description:
      'Custom scents, hand-set labels, and photo-embedded keepsakes are made to order. Start early and yours arrives in time.',
    bgImage: ASSET_IMAGES.promotional_one.third,
    ctaText: 'Begin a commission',
    targetCollectionId: 'bespoke-personalized',
  },
  {
    id: 'sculpture-series',
    tagline: 'New Sculpture Series',
    title: 'Desserts that melts with',
    highlightText: 'a warm glow',
    description:
      'Gourmet wax sculpture — layered parfaits, cold-pressed smoothies, and cocktail pours, sculpted by hand.',
    bgImage: ASSET_IMAGES.promotional_one.second,
    ctaText: 'Discover the series',
    targetCollectionId: 'sculptural-decorative',
  },
];

/* -------------------------------------------------------------------------- */
/* Placement 2 — Reasons                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Why own a candle at all — claims, not feature bullets.
 *
 * Deliberately image-free. This band sits between two photographic screens and
 * its job is to give the eye somewhere quiet to land, so the type carries it.
 */
export const REASON_SLIDES: ReasonSlide[] = [
  {
    id: 'reason-room',
    lead: 'A room does not change',
    highlight: 'until you light it',
    trail: '.',
    support: 'One flame redraws a space more completely than any object you could put in it.',
    ctaText: 'Browse jars & vessels',
    targetCollectionId: 'container-jar',
  },
  {
    id: 'reason-memory',
    lead: 'Scent is the shortest road',
    highlight: 'back to a memory',
    trail: '.',
    support: 'Smell reaches memory before language does. It is the only sense wired that directly.',
    ctaText: 'Blend your own scent',
    targetCollectionId: 'bespoke-personalized',
  },
  {
    id: 'reason-soy',
    lead: 'Soy burns clean.',
    highlight: 'Paraffin does not',
    trail: '.',
    support:
      'Every candle we pour is natural soy wax with a cotton or wooden wick. No petroleum, no soot.',
    ctaText: 'See how we pour',
    targetCollectionId: 'specialty-wax',
  },
  {
    id: 'reason-gift',
    lead: 'The rare gift that gets',
    highlight: 'used, then remembered',
    trail: '.',
    support:
      'It is spent slowly, in the evenings, in their own home. Few objects earn that kind of attention.',
    ctaText: 'Explore gifting',
    targetCollectionId: 'traditional-festive',
  },
  {
    id: 'reason-hand',
    lead: 'Poured by hand,',
    highlight: 'in small batches',
    trail: '.',
    support:
      'Every piece is measured, poured, cured, and finished in our studio. No two are quite identical.',
    ctaText: 'Sculptural & decorative',
    targetCollectionId: 'sculptural-decorative',
  },
];

/* -------------------------------------------------------------------------- */
/* Placement 3 — Gifting                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Gifting occasions, each mapped onto the collection that serves it.
 *
 * Gifting is a cross-cut, not a category — someone shopping for a wedding wants
 * bespoke labels, and someone shopping for a maker friend wants raw materials.
 * Adding a seventh "Gifting" collection would break the fixed hierarchy in
 * `CANDLE_CATEGORIES`; this maps intent onto existing ids instead.
 */
export const GIFTING_SLIDES: GiftingSlide[] = [
  {
    id: 'gift-wedding',
    occasion: 'Weddings & Favours',
    title: 'Two names, set in wax',
    body: 'Custom labels with names and dates, poured at volume for the table.',
    image: ASSET_IMAGES.categories.bespoke,
    targetCollectionId: 'bespoke-personalized',
  },
  {
    id: 'gift-corporate',
    occasion: 'Corporate Hampers',
    title: 'Gifts that carry your mark',
    body: 'Frosted glass and tins, labelled with your identity rather than ours.',
    image: ASSET_IMAGES.categories.containerJar,
    targetCollectionId: 'container-jar',
  },
  {
    id: 'gift-festive',
    occasion: 'Festive Gifting',
    title: 'For the season of light',
    body: 'Brass urlis and floral diyas, arriving already worth unwrapping.',
    image: ASSET_IMAGES.categories.traditional,
    targetCollectionId: 'traditional-festive',
  },
  {
    id: 'gift-maker',
    occasion: 'For the Maker',
    title: 'Everything but the pouring',
    body: 'Studio-grade wax, wicks, moulds and oils for the one who would rather make it.',
    image: ASSET_IMAGES.categories.rawMaterials,
    targetCollectionId: 'raw-materials',
  },
];

/* -------------------------------------------------------------------------- */
/* Development-time integrity check                                            */
/* -------------------------------------------------------------------------- */

/**
 * Fails loudly in development when a slide points at a collection id that does
 * not exist.
 *
 * This is not defensive over-engineering — it is a regression guard. Two of the
 * three original promo slides targeted `festive-urlis` and `sculptural-food`,
 * neither of which is in `CANDLE_CATEGORIES`. Both CTAs quietly bounced to
 * `/collections` through the unknown-slug redirect, so the carousel looked
 * completely functional while half its links were dead. A JSDoc comment warning
 * "must match an id" was already present above that data and did not help.
 *
 * Runs only under `import.meta.env.DEV`, so production ships nothing.
 */
function assertTargetsResolve(): void {
  const validIds = new Set(CANDLE_CATEGORIES.map((category) => category.id));

  const broken = [
    ...OFFER_SLIDES.map((s) => ({ placement: 'OFFER_SLIDES', ...s })),
    ...REASON_SLIDES.map((s) => ({ placement: 'REASON_SLIDES', ...s })),
    ...GIFTING_SLIDES.map((s) => ({ placement: 'GIFTING_SLIDES', ...s })),
  ].filter((slide) => !validIds.has(slide.targetCollectionId));

  if (broken.length === 0) return;

  const details = broken
    .map((s) => `  • ${s.placement} › "${s.id}" → "${s.targetCollectionId}"`)
    .join('\n');

  throw new Error(
    `[promotions] ${broken.length} slide(s) target a collection id that does not exist:\n${details}\n\n` +
      `Valid ids: ${[...validIds].join(', ')}\n` +
      `Fix the slide, not CANDLE_CATEGORIES — ids are URL slugs and renaming one breaks live links.`
  );
}

if (import.meta.env.DEV) assertTargetsResolve();
