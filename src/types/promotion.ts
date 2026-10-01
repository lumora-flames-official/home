import type { ResponsivePicture } from './image';

/**
 * Slide contracts for the three promotional placements on the home page.
 *
 * Each placement has its own template and its own shape — a photographic offer
 * slide, a type-only claim, and a gifting occasion card share a purpose but not
 * a set of fields. One permissive union with half its properties optional would
 * push "does this slide have an image?" checks into every template; three narrow
 * interfaces let each template require exactly what it renders.
 *
 * Every `targetCollectionId` must match an id in `CANDLE_CATEGORIES`. That is
 * enforced at runtime in development — see `assertTargetsResolve` in
 * `data/promotions.ts`.
 */

/** Shared by every placement: a stable key and a destination. */
interface PromotionBase {
  /** Stable React key, also used to re-key media so the browser reloads it. */
  id: string;
  /**
   * `CANDLE_CATEGORIES` id this slide routes to. Validated in development,
   * because a typo here fails silently — the unknown-slug route redirects to
   * `/collections`, so a broken CTA still *looks* like it worked.
   */
  targetCollectionId: string;
}

/**
 * A full-bleed photographic promotion — the offers carousel.
 *
 * `title` and `highlightText` are separate because the brand's typographic
 * signature is a `font-light` phrase colliding with an amber italic one. Keep
 * the split; don't merge them into a single string.
 */
export interface PromoSlide extends PromotionBase {
  /** Small uppercase label above the headline. */
  tagline: string;
  /** Headline, rendered light-weight. */
  title: string;
  /** Trailing fragment of the headline, rendered in amber italic. */
  highlightText: string;
  /** One or two sentences of supporting copy. */
  description: string;
  /**
   * Responsive picture data from `data/assets.ts` — never a raw `src/...` path, and no
   * longer a plain URL either. Rendered through `ResponsiveImage`, which needs the
   * several widths a single `src` cannot carry.
   */
  bgImage: ResponsivePicture;
  /** CTA label. */
  ctaText: string;
}

/**
 * A single reason to own a candle, rendered as oversized type with no imagery.
 *
 * The statement is split into three parts so the amber emphasis can fall in the
 * middle of a sentence rather than only at the end.
 */
export interface ReasonSlide extends PromotionBase {
  /** Opening fragment, rendered light-weight. May be empty. */
  lead: string;
  /** Emphasised fragment, rendered in amber italic. */
  highlight: string;
  /** Closing fragment, rendered light-weight. May be empty. */
  trail: string;
  /** One supporting line beneath the statement. */
  support: string;
  /** CTA label. */
  ctaText: string;
}

/**
 * A gifting occasion, rendered as a tall portrait card in the drifting ribbon.
 *
 * Gifting cross-cuts the catalogue rather than sitting inside it: there is no
 * "gifting" collection and there must not be one — `CANDLE_CATEGORIES` is the
 * source of truth and its hierarchy is fixed. Each occasion instead *maps onto*
 * the collection that serves it.
 */
export interface GiftingSlide extends PromotionBase {
  /** Small uppercase label naming the occasion. */
  occasion: string;
  /** Card headline. Kept short — these are read while the ribbon moves. */
  title: string;
  /** One line of supporting copy. */
  body: string;
  /** Responsive picture data from `data/assets.ts`, rendered via `ResponsiveImage`. */
  image: ResponsivePicture;
}
