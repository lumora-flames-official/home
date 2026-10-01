import type { ResponsivePicture } from './image';

/**
 * Silhouette the procedural candle renders for a subcategory.
 *
 * Drives geometry only — proportions, rim, and base — never colour. Adding a
 * variant requires a matching branch in `InteractiveCandleCanvas`.
 */
export type CandleVessel = 'jar' | 'pillar' | 'urli' | 'sculpture' | 'raw';

/**
 * Material identity for a subcategory's rendered candle.
 *
 * These are wax and glass tones — cream, sand, stone, terracotta — not accent
 * colours. Amber remains the sole accent; nothing here is used for a CTA,
 * active state, or emphasis, so the single-accent rule still holds.
 */
export interface CandleVisual {
  /** Silhouette to render. */
  vessel: CandleVessel;
  /** Wax body gradient start, as a hex string. */
  waxFrom: string;
  /** Wax body gradient end, as a hex string. */
  waxTo: string;
  /** Second line on the candle's label — the subcategory's scent or material. */
  labelNote: string;
}

/** One variety within a collection. */
export interface SubCategory {
  id: string;
  name: string;
  description: string;
  examples: string[];
  /**
   * Optional visual identity for the procedural candle. When omitted the
   * canvas falls back to a neutral jar, so new content can be added without
   * immediately authoring a visual.
   */
  visual?: CandleVisual;
}

/** A top-level collection, as surfaced in navigation and on the landing page. */
export interface Category {
  id: string;
  title: string;
  tagline: string;
  description: string;
  subCategories: SubCategory[];
  /**
   * Responsive picture data from `src/data/assets.ts`, rendered via `ResponsiveImage`.
   *
   * Not a URL string, which is what it was until the photography was measured at 15.9 MB
   * for one scroll of the home page. A single `src` can only ever carry one width, and a
   * 390px phone should not download a 1344px file — nor hold its bitmap in memory, which
   * costs `w × h × 4` bytes whatever the codec.
   */
  heroImage: ResponsivePicture;
}
