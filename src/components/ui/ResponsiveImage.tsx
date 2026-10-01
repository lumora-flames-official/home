import React from 'react';
import type { ResponsivePicture } from '../../types/image';

/** Props for {@link ResponsiveImage}. */
export interface ResponsiveImageProps {
  /** Build-time picture data from a `&as=picture` import in `src/data/assets.ts`. */
  picture: ResponsivePicture;
  /** Alternative text. Pass `''` for decorative imagery — never omit it. */
  alt: string;
  /**
   * CSS `sizes`, describing how wide this image renders at each breakpoint.
   *
   * **Required, and the most consequential prop here.** Omit it and the browser assumes
   * `100vw`, so a 200px-wide thumbnail downloads the 1344px variant and every byte this
   * component exists to save is spent anyway. It fails silently — the picture looks
   * perfect — which is why there is no default.
   */
  sizes: string;
  /**
   * Skip lazy loading and raise fetch priority. Set this on the one image that is the
   * page's largest contentful paint, and nowhere else: marking several `eager` makes them
   * compete for the same bandwidth and delays all of them.
   */
  eager?: boolean;
  /** Classes for the `<img>`. The wrapping `<picture>` is layout-neutral. */
  className?: string;
  /**
   * Forwarded to the `<img>`, not the `<picture>`.
   *
   * `CollectionShowcase` scrubs `yPercent` on the image element itself, so it needs a
   * handle on the thing that actually paints. A ref on the wrapper would animate a
   * zero-height layout box and appear to do nothing.
   */
  ref?: React.Ref<HTMLImageElement>;
}

/**
 * A photograph at whatever size the viewport actually needs.
 *
 * Every hand-authored photograph on the site renders through this. It exists because the
 * alternative — a bare `<img src>` — can only ever ship one size of one format, and the
 * measured cost of that was 15.9 MB of PNG on a single scroll of the home page.
 *
 * ## Why `<picture>` and not just `srcSet` on the `<img>`
 *
 * `srcSet` alone handles multiple *widths* of one format. `<picture>` additionally lets
 * the browser pick a *format*, falling back when it doesn't recognise one. Today every
 * master is WebP so there is a single `<source>` and the two would behave identically —
 * but adding AVIF later then costs a query-string change in `assets.ts` and nothing here.
 *
 * ## No GSAP
 *
 * There is no motion in this component, so there is nothing for `useGSAP` to scope. Any
 * animation belongs to the section that places the image, which is where the
 * reduced-motion branch already lives.
 */
export const ResponsiveImage: React.FC<ResponsiveImageProps> = ({
  picture,
  alt,
  sizes,
  eager = false,
  className,
  ref,
}) => (
  <picture>
    {Object.entries(picture.sources).map(([format, srcSet]) => (
      <source key={format} type={`image/${format}`} srcSet={srcSet} sizes={sizes} />
    ))}
    <img
      ref={ref}
      src={picture.img.src}
      alt={alt}
      // Intrinsic dimensions, so the box is reserved before the bytes arrive.
      width={picture.img.w}
      height={picture.img.h}
      loading={eager ? 'eager' : 'lazy'}
      // `high` only when eager: the attribute is meaningless on a lazy image, and
      // setting it everywhere would flatten the priority signal it exists to give.
      fetchPriority={eager ? 'high' : undefined}
      decoding="async"
      className={className}
    />
  </picture>
);
