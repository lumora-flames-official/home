/**
 * Shape of a build-time responsive image.
 *
 * This is what `vite-imagetools` returns for an import ending `&as=picture`. It is
 * re-declared here rather than imported from the plugin for one reason: it appears on
 * `Category.heroImage` and `PromoSlide.bgImage`, which are content types the whole app
 * reads. Pinning those to a build tool's exported type would make swapping the image
 * pipeline a change to the data model.
 */
export interface ResponsivePicture {
  /**
   * MIME subtype → `srcset` string, e.g. `{ webp: 'a-640.webp 640w, a-1024.webp 1024w' }`.
   *
   * Rendered as one `<source>` per entry. Today every master is already WebP so there is
   * exactly one key; adding `&format=avif;webp` to the import would make it two, and
   * `ResponsiveImage` would then emit both without any other change.
   */
  sources: Record<string, string>;
  /**
   * The fallback, and the intrinsic dimensions.
   *
   * `w`/`h` matter beyond the `<img>` attributes: giving the browser the aspect ratio up
   * front is what stops these large images reflowing the page as they arrive, which they
   * did before this existed.
   */
  img: { src: string; w: number; h: number };
}
