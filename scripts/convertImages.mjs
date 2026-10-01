/**
 * One-off converter for the hand-authored photography in `src/data/images/`.
 *
 * Run by hand, never in CI. It rewrites files in the source tree, so it belongs in the
 * same category as `/update-list` — a maintainer tool, not part of the build:
 *
 *     node scripts/convertImages.mjs          # report what it would do
 *     node scripts/convertImages.mjs --write  # actually convert
 *
 * ## Why this exists at all
 *
 * The nine collection and promo images were 20.1 MB of **PNG**, which is a lossless
 * format holding photographs. At WebP q82 the same nine are 1.26 MB — a measured 15.9×,
 * with no visible difference at 2× device pixel ratio. That one fact was 97% of the
 * deployed site.
 *
 * Photos added *after* this are converted on upload by `scripts/catalogDevApi.ts`, so
 * this script is only for the imagery that predates that and is imported by name in
 * `src/data/assets.ts`. It is kept rather than deleted because the same job recurs
 * whenever someone hand-adds an image outside the CMS.
 *
 * ## What it deliberately does not do
 *
 * It does not resize. These are 1408×768 to 1920×1080, which is the right size for a
 * full-bleed backdrop on a large display — `vite-imagetools` derives the smaller
 * responsive widths at build time from these masters, so shrinking here would cap the
 * quality of every variant.
 *
 * It does not touch `src/data/catalog-images/`. Those are CMS-written and already small.
 *
 * ## Recovering a master
 *
 * `--write` deletes the source PNG. Git history still has it — `.git` does not shrink,
 * only the working tree and future checkouts do — so the way back to an original is:
 *
 *     git show <rev>:src/data/images/collections-landing/bespoke.png > bespoke.png
 */

import { readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

/** Repo root, derived from this file's location so the script is not cwd-sensitive. */
const ROOT = path.resolve(import.meta.dirname, '..');
const IMAGES_ROOT = path.join(ROOT, 'src', 'data', 'images');
const ASSETS_FILE = path.join(ROOT, 'src', 'data', 'assets.ts');
const PUBLIC_DIR = path.join(ROOT, 'public');

/**
 * Quality for the WebP masters.
 *
 * Measured across all nine sources: q75 averaged 24× smaller but showed banding in the
 * smooth wax gradients, q90 only reached 12×. q82 is the knee of that curve — 15.9×,
 * and indistinguishable from the PNG at 2× DPR, which is the bar the brand needs.
 */
const QUALITY = 82;

/** Extensions worth converting. `.svg` is already vector; `.webp` is already done. */
const CONVERTIBLE = new Set(['.png', '.jpg', '.jpeg']);

/**
 * Open Graph card dimensions.
 *
 * 1200×630 is what WhatsApp, iMessage and Twitter all crop against, and the site's whole
 * conversion path is a link pasted into a chat. **JPEG, not WebP** — WhatsApp's preview
 * fetcher does not reliably render WebP, and a preview that silently fails to draw is
 * worse than a slightly larger file.
 */
const OG = { width: 1200, height: 630, quality: 86, source: 'collections-landing/bespoke' };

const write = process.argv.includes('--write');

/** Every convertible file under `src/data/images/`, recursively. */
const collect = async (dir) => {
  const found = [];

  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await collect(full)));
    else if (CONVERTIBLE.has(path.extname(entry.name).toLowerCase())) found.push(full);
  }

  return found;
};

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;
const mb = (bytes) => `${(bytes / 1048576).toFixed(2)} MB`;

/**
 * Rewrites the `import` paths in `assets.ts` to the new extensions.
 *
 * String replacement rather than a real parse, because the target is a list of literal
 * import specifiers and nothing else in the file can match a full image path. A rename
 * that does not land here is caught immediately: the build fails on a missing module,
 * which is exactly the guarantee `assets.ts` exists to provide.
 */
const rewriteAssets = async (renames) => {
  let source = await readFile(ASSETS_FILE, 'utf8');

  for (const [from, to] of renames) {
    source = source.split(from).join(to);
  }

  await writeFile(ASSETS_FILE, source, 'utf8');
};

const main = async () => {
  const files = await collect(IMAGES_ROOT);
  if (files.length === 0) {
    console.log('Nothing to convert — no PNG or JPEG under src/data/images/.');
    return;
  }

  console.log(`${write ? 'Converting' : 'Dry run —'} ${files.length} file(s) at q${QUALITY}\n`);

  const renames = [];
  let before = 0;
  let after = 0;

  for (const file of files) {
    const original = (await stat(file)).size;
    const target = `${file.slice(0, -path.extname(file).length)}.webp`;

    const buffer = await sharp(file).webp({ quality: QUALITY }).toBuffer();
    before += original;
    after += buffer.length;

    const relative = path.relative(ROOT, file);
    const ratio = (original / buffer.length).toFixed(0);
    console.log(`  ${relative}\n    ${mb(original)} → ${kb(buffer.length)}  (${ratio}×)`);

    if (!write) continue;

    await writeFile(target, buffer);
    // Only after the .webp is on disk, for the same reason the catalog API writes the new
    // file before touching JSON: an interruption must never leave an import with no file.
    await unlink(file);
    renames.push([path.basename(file), path.basename(target)]);
  }

  console.log(
    `\nTotal: ${mb(before)} → ${mb(after)}  (${(before / after).toFixed(1)}× smaller, saves ${mb(before - after)})`
  );

  if (!write) {
    console.log('\nNothing written. Re-run with --write to apply.');
    return;
  }

  await rewriteAssets(renames);
  console.log(`\nRewrote ${renames.length} import path(s) in src/data/assets.ts`);

  /*
   * The Open Graph card. Generated here rather than committed by hand so it is always
   * derived from real brand photography, and regenerating it is one command.
   */
  const ogSource = files.find((file) => file.includes(OG.source)) ?? files[0];
  const ogTarget = path.join(PUBLIC_DIR, 'og.jpg');

  await sharp(`${ogSource.slice(0, -path.extname(ogSource).length)}.webp`)
    .resize(OG.width, OG.height, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: OG.quality, mozjpeg: true })
    .toFile(ogTarget);

  console.log(`Wrote public/og.jpg (${OG.width}×${OG.height}, ${kb((await stat(ogTarget)).size)})`);
  console.log('\nNext: npm run lint && npm run format:check && npm run test && npm run build');
};

await main();
