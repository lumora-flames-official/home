/**
 * Resolves CMS-uploaded product photography to hashed, base-aware URLs.
 *
 * ## Why a glob and not an entry in `assets.ts`
 *
 * `ASSET_IMAGES` lists every image as a named `import`, which is what makes the
 * hard rule "images are imported, never path strings" enforceable — a missing
 * file fails the build. Catalog photography cannot work that way: it is added by
 * the CMS, so nobody hand-writes the import, and a registry someone has to
 * remember to update is a registry that will be stale.
 *
 * `import.meta.glob` is the same guarantee applied to a whole directory. It runs
 * at build time, so Vite still fingerprints each file, still rewrites the URL for
 * whatever `base` the deploy uses, and still inlines nothing at runtime. The
 * difference from `assets.ts` is only *who* enumerates the files.
 *
 * ## Why not `public/catalog/`
 *
 * That was the obvious approach and it breaks in production specifically. The
 * site is served from a base prefix — `/lumora_flames/` for production and
 * `/lumora_flames/pr-N/` for previews — so a stored `/catalog/x.jpg` resolves
 * above the deploy root and 404s. It works in dev, where `base` is `/`, which is
 * exactly what makes it a bad failure: local looks correct. Prefixing every
 * render with `import.meta.env.BASE_URL` would fix the path but still forfeits
 * content hashing, so replacing a photo under the same filename would serve the
 * old one from cache.
 */

/**
 * Every file under `catalog-images/`, keyed by its path *relative to that
 * directory* — e.g. `bespoke-personalized/amber-glow.jpg`.
 *
 * `query: '?url'` asks for the emitted URL rather than the decoded module, and
 * `eager` resolves them synchronously so callers are plain property lookups
 * rather than promises. The whole map is URL strings, so being eager costs a few
 * bytes per image, not the images themselves.
 */
const GLOBBED = import.meta.glob<string>('./catalog-images/**/*.{jpg,jpeg,png,webp,avif}', {
  eager: true,
  query: '?url',
  import: 'default',
});

/** Glob keys arrive as `./catalog-images/<rest>`; the prefix carries no meaning. */
const GLOB_PREFIX = './catalog-images/';

/**
 * Product image URLs, keyed `<categoryId>/<filename>`.
 *
 * @example
 * CATALOG_IMAGES['bespoke-personalized/amber-glow.jpg']
 * // → '/lumora_flames/assets/amber-glow-a3f9c1.jpg'
 */
export const CATALOG_IMAGES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(GLOBBED).map(([key, url]) => [key.slice(GLOB_PREFIX.length), url])
);

/**
 * Looks up the hashed URL for one product photo.
 *
 * @param categoryId Owning collection id — the directory the file sits in.
 * @param filename Stored `StoredProduct.image`, filename only.
 * @returns The emitted URL, or `undefined` when no such file is on disk. Callers
 *   should not paper over `undefined`: `assertCatalogResolves` turns it into a
 *   thrown error in dev, because a silently broken `<img>` on a product card is
 *   a listing that looks published and isn't.
 */
export const catalogImageUrl = (categoryId: string, filename: string): string | undefined =>
  CATALOG_IMAGES[`${categoryId}/${filename}`];
