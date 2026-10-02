/**
 * Generates a luxury PPTX product catalogue from catalog.json.
 *
 * Run manually:  npx tsx scripts/generateCatalog.ts
 * In CI:         triggered by catalog-export.yml on catalog.json / catalog-images changes.
 *
 * Output: public/catalog.pptx — committed to repo so it is live on the site.
 */

import { createRequire } from 'module';

const _require = createRequire(import.meta.url);
// pptxgenjs ships as CJS; createRequire gives reliable ESM interop.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PptxGenJS = _require('pptxgenjs') as { new (): any };

// Single alias so every slide builder shares one eslint-disable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Pptx = any;
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { formatPrice } from '../src/lib/formatPrice.ts';
import type { CatalogData, StoredProduct } from '../src/types/catalog.ts';

// Inlined from src/data/contact.ts — contact.ts uses import.meta.env.DEV which
// doesn't exist in Node. Keep these in sync when the studio's handles change.
const CONTACT = {
  whatsapp: '+91 98733 01173',
  instagram: '@lumora_flames',
  site: '${CONTACT.site}',
} as const;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const IMG_DIR = join(ROOT, 'src', 'data', 'catalog-images');
const OUT_PATH = join(ROOT, 'public', 'catalog.pptx');

// ─── Collection metadata ───────────────────────────────────────────────────
// Text-only mirror of CANDLE_CATEGORIES. Cannot import from categories.ts
// because heroImage uses vite-imagetools queries that don't resolve in Node.
const COLLECTIONS = [
  {
    id: 'bespoke-personalized',
    title: 'Bespoke & Personalized',
    tagline: 'Made to your memory',
  },
  {
    id: 'traditional-festive',
    title: 'Traditional & Festive',
    tagline: 'Sacred flames for auspicious moments',
  },
  {
    id: 'sculptural-decorative',
    title: 'Sculptural & Decorative',
    tagline: 'Art you can light',
  },
  {
    id: 'speciality-wax',
    title: 'Specialty Wax',
    tagline: 'Texture and character in every curve',
  },
  {
    id: 'container-jar',
    title: 'Container & Jar',
    tagline: 'Long-burning ambience in every vessel',
  },
  {
    id: 'raw-materials',
    title: 'Raw Materials',
    tagline: 'For the candle maker in you',
  },
] as const;

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Splits an array into chunks of `size`. Used for 2-products-per-slide. */
function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

/** `beverage-food` → `Beverage Food`. Fallback for variety slugs not in catalog. */
function toTitle(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Resolved filesystem path for a product image. */
function imagePath(categoryId: string, product: StoredProduct): string {
  return join(IMG_DIR, categoryId, product.image);
}

// ─── Colours ──────────────────────────────────────────────────────────────
const C = {
  bg: '0C0A09', // stone-950
  bgDivider: '1C1917', // stone-900, faint bg for large numbers
  white: 'F5F5F0',
  amber: 'F59E0B',
  stone400: 'A8A29E',
  stone500: '78716C',
  stone700: '44403C',
  stone800: '292524',
} as const;

// ─── Slide builders ───────────────────────────────────────────────────────

function addCover(pptx: Pptx): void {
  const slide = pptx.addSlide();
  slide.background = { color: C.bg };

  // Faint amber glow — oval shape behind wordmark
  slide.addShape(pptx.ShapeType.ellipse, {
    x: 3.5,
    y: 1.5,
    w: 6.33,
    h: 5,
    fill: { type: 'solid', color: 'F59E0B', alpha: 92 },
    line: { color: C.bg, width: 0 },
  });

  slide.addText('LUMORA', {
    x: 0,
    y: 2.5,
    w: 13.33,
    h: 1.0,
    fontSize: 72,
    fontFace: 'Georgia',
    color: C.amber,
    bold: false,
    align: 'center',
    charSpacing: 1200,
  });

  slide.addText('FLAMES', {
    x: 0,
    y: 3.45,
    w: 13.33,
    h: 0.65,
    fontSize: 38,
    fontFace: 'Georgia',
    color: C.stone400,
    bold: false,
    align: 'center',
    charSpacing: 800,
  });

  // Amber rule
  slide.addShape(pptx.ShapeType.rect, {
    x: 5.67,
    y: 4.3,
    w: 2,
    h: 0.03,
    fill: { type: 'solid', color: C.amber },
    line: { color: C.amber, width: 0 },
  });

  slide.addText('Artisanal Candle Collection', {
    x: 0,
    y: 4.5,
    w: 13.33,
    h: 0.4,
    fontSize: 13,
    fontFace: 'Calibri',
    color: C.white,
    align: 'center',
    charSpacing: 400,
  });

  slide.addText(`${new Date().getFullYear()}`, {
    x: 0.5,
    y: 7.1,
    w: 2,
    h: 0.25,
    fontSize: 8,
    fontFace: 'Calibri',
    color: C.stone700,
  });

  slide.addText('${CONTACT.site}', {
    x: 9,
    y: 7.1,
    w: 4.0,
    h: 0.25,
    fontSize: 8,
    fontFace: 'Calibri',
    color: C.stone700,
    align: 'right',
  });
}

function addCollectionDivider(
  pptx: Pptx,
  collection: (typeof COLLECTIONS)[number],
  index: number,
  productCount: number
): void {
  const slide = pptx.addSlide();
  slide.background = { color: C.bg };

  // Large faint collection number — barely visible on dark bg
  slide.addText(String(index + 1).padStart(2, '0'), {
    x: -0.3,
    y: 2.8,
    w: 8,
    h: 5,
    fontSize: 180,
    fontFace: 'Georgia',
    color: C.bgDivider,
    bold: false,
  });

  slide.addText(collection.title, {
    x: 0.8,
    y: 1.8,
    w: 10,
    h: 1.0,
    fontSize: 44,
    fontFace: 'Georgia',
    color: C.white,
    bold: false,
  });

  slide.addText(collection.tagline.toUpperCase(), {
    x: 0.8,
    y: 2.9,
    w: 8,
    h: 0.35,
    fontSize: 10,
    fontFace: 'Calibri',
    color: C.amber,
    charSpacing: 300,
  });

  // Amber rule
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8,
    y: 3.35,
    w: 2.5,
    h: 0.03,
    fill: { type: 'solid', color: C.amber },
    line: { color: C.amber, width: 0 },
  });

  const countLabel =
    productCount > 0
      ? `${productCount} ${productCount === 1 ? 'candle' : 'candles'} listed`
      : 'Available on bespoke order';

  slide.addText(countLabel, {
    x: 0.8,
    y: 3.5,
    w: 6,
    h: 0.3,
    fontSize: 9,
    fontFace: 'Calibri',
    color: C.stone500,
    charSpacing: 100,
  });
}

function addCommissionSlide(pptx: Pptx): void {
  const slide = pptx.addSlide();
  slide.background = { color: C.bg };

  slide.addText('Commission Your Candle', {
    x: 0,
    y: 2.0,
    w: 13.33,
    h: 0.9,
    fontSize: 36,
    fontFace: 'Georgia',
    color: C.white,
    bold: false,
    align: 'center',
  });

  slide.addText('Every candle is poured to order in small batches.', {
    x: 0,
    y: 3.0,
    w: 13.33,
    h: 0.4,
    fontSize: 13,
    fontFace: 'Calibri',
    color: C.stone400,
    align: 'center',
  });

  // Amber rule
  slide.addShape(pptx.ShapeType.rect, {
    x: 5.67,
    y: 3.55,
    w: 2,
    h: 0.03,
    fill: { type: 'solid', color: C.amber },
    line: { color: C.amber, width: 0 },
  });

  slide.addText(`WhatsApp  ·  ${CONTACT.whatsapp}`, {
    x: 0,
    y: 3.8,
    w: 13.33,
    h: 0.4,
    fontSize: 12,
    fontFace: 'Calibri',
    color: C.amber,
    align: 'center',
    charSpacing: 100,
  });

  slide.addText(`Instagram  ·  ${CONTACT.instagram}`, {
    x: 0,
    y: 4.3,
    w: 13.33,
    h: 0.35,
    fontSize: 11,
    fontFace: 'Calibri',
    color: C.stone400,
    align: 'center',
    charSpacing: 100,
  });

  slide.addText('${CONTACT.site}', {
    x: 0,
    y: 4.75,
    w: 13.33,
    h: 0.3,
    fontSize: 9,
    fontFace: 'Calibri',
    color: C.stone500,
    align: 'center',
  });

  slide.addText('LUMORA FLAMES', {
    x: 0,
    y: 7.1,
    w: 13.33,
    h: 0.25,
    fontSize: 8,
    fontFace: 'Calibri',
    color: C.stone700,
    align: 'center',
    charSpacing: 300,
  });
}

function addProductSlide(
  pptx: Pptx,
  pair: StoredProduct[],
  categoryId: string,
  collectionTitle: string,
  varietyName: string
): void {
  const slide = pptx.addSlide();
  slide.background = { color: C.bg };

  // ── Header ──────────────────────────────────────────────────────────────
  slide.addText(`${collectionTitle.toUpperCase()}  ·  ${varietyName.toUpperCase()}`, {
    x: 0.5,
    y: 0.22,
    w: 12.3,
    h: 0.22,
    fontSize: 7,
    fontFace: 'Calibri',
    color: C.amber,
    charSpacing: 250,
  });

  // Horizontal header rule
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.5,
    y: 0.55,
    w: 12.3,
    h: 0.015,
    fill: { type: 'solid', color: C.stone800 },
    line: { color: C.stone800, width: 0 },
  });

  // Vertical centre divider
  slide.addShape(pptx.ShapeType.rect, {
    x: 6.665,
    y: 0.55,
    w: 0.015,
    h: 6.6,
    fill: { type: 'solid', color: C.stone800 },
    line: { color: C.stone800, width: 0 },
  });

  // ── Per-product zones ────────────────────────────────────────────────────
  pair.forEach((product, i) => {
    const xBase = i === 0 ? 0.5 : 7.1;
    const textX = xBase + 3.0;
    const textW = 2.85;

    // Product image
    const imgPath = imagePath(categoryId, product);
    if (existsSync(imgPath)) {
      slide.addImage({
        path: imgPath,
        x: xBase,
        y: 0.75,
        w: 2.8,
        h: 3.7,
        sizing: { type: 'cover', w: 2.8, h: 3.7 },
        rounding: true,
      });
    } else {
      // Placeholder when image not found
      slide.addShape(pptx.ShapeType.rect, {
        x: xBase,
        y: 0.75,
        w: 2.8,
        h: 3.7,
        fill: { type: 'solid', color: C.stone800 },
        line: { color: C.stone700, width: 1 },
      });
      slide.addText('No image', {
        x: xBase,
        y: 2.4,
        w: 2.8,
        h: 0.35,
        fontSize: 8,
        fontFace: 'Calibri',
        color: C.stone500,
        align: 'center',
      });
    }

    // Product name
    slide.addText(product.name, {
      x: textX,
      y: 0.78,
      w: textW,
      h: 1.1,
      fontSize: 15,
      fontFace: 'Georgia',
      color: C.white,
      bold: false,
      wrap: true,
    });

    // Price
    slide.addText(formatPrice(product.priceInr), {
      x: textX,
      y: 2.05,
      w: textW,
      h: 0.45,
      fontSize: 20,
      fontFace: 'Georgia',
      color: C.amber,
      bold: false,
    });

    // SKU
    slide.addText(product.sku, {
      x: textX,
      y: 2.6,
      w: textW,
      h: 0.28,
      fontSize: 8,
      fontFace: 'Calibri',
      color: C.stone500,
      charSpacing: 80,
    });

    // Fragrance notes — up to 4, as bullet list
    if (product.fragrance.length > 0) {
      const notes = product.fragrance.slice(0, 4);
      slide.addText(
        notes.map((note, idx) => ({
          text: `◦  ${note}`,
          options: { breakLine: idx < notes.length - 1 },
        })),
        {
          x: textX,
          y: 3.0,
          w: textW,
          h: 1.3,
          fontSize: 8.5,
          fontFace: 'Calibri',
          color: C.stone400,
          lineSpacing: 13,
          wrap: true,
        }
      );
    }

    // Poured to order note
    slide.addText('Poured to order. Quote SKU when enquiring.', {
      x: textX,
      y: 4.45,
      w: textW,
      h: 0.3,
      fontSize: 7.5,
      fontFace: 'Calibri',
      color: C.stone700,
      italic: true,
    });
  });

  // ── Footer ───────────────────────────────────────────────────────────────
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.5,
    y: 7.12,
    w: 12.3,
    h: 0.015,
    fill: { type: 'solid', color: C.stone800 },
    line: { color: C.stone800, width: 0 },
  });

  slide.addText('LUMORA FLAMES', {
    x: 0.5,
    y: 7.2,
    w: 4,
    h: 0.2,
    fontSize: 7,
    fontFace: 'Calibri',
    color: C.stone700,
    charSpacing: 150,
  });

  slide.addText('${CONTACT.site}', {
    x: 7,
    y: 7.2,
    w: 5.83,
    h: 0.2,
    fontSize: 7,
    fontFace: 'Calibri',
    color: C.stone700,
    align: 'right',
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function generate(): Promise<void> {
  const catalogRaw = readFileSync(join(ROOT, 'src', 'data', 'catalog.json'), 'utf-8');
  const catalog = JSON.parse(catalogRaw) as CatalogData;

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'WIDESCREEN', width: 13.33, height: 7.5 });
  pptx.layout = 'WIDESCREEN';
  pptx.title = 'Lumora Flames — Artisanal Candle Catalogue';
  pptx.author = 'Lumora Flames';

  // 1. Cover
  addCover(pptx);

  // 2. Collection dividers + product slides
  COLLECTIONS.forEach((collection, index) => {
    const catData = catalog[collection.id] ?? {};
    const allProducts = Object.values(catData).flat();
    const totalCount = allProducts.length;

    addCollectionDivider(pptx, collection, index, totalCount);

    if (totalCount === 0) {
      // Commission slide for empty collections
      const slide = pptx.addSlide();
      slide.background = { color: C.bg };
      slide.addText('Available on Bespoke Order', {
        x: 0,
        y: 3.0,
        w: 13.33,
        h: 0.7,
        fontSize: 22,
        fontFace: 'Georgia',
        color: C.stone400,
        align: 'center',
        italic: true,
      });
      slide.addText('Message us on WhatsApp or Instagram to commission this collection.', {
        x: 0,
        y: 3.9,
        w: 13.33,
        h: 0.4,
        fontSize: 11,
        fontFace: 'Calibri',
        color: C.stone500,
        align: 'center',
      });
    } else {
      // Group by variety, then pair products for 2-per-slide
      Object.entries(catData).forEach(([varietyId, products]) => {
        const varietyName = toTitle(varietyId);
        const pairs = chunk(products, 2);
        pairs.forEach((pair) => {
          addProductSlide(pptx, pair, collection.id, collection.title, varietyName);
        });
      });
    }
  });

  // 3. Back / commission closing slide
  addCommissionSlide(pptx);

  // Write output
  const buffer = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
  writeFileSync(OUT_PATH, buffer);

  const totalSlides = 1 + COLLECTIONS.length * 2 + 1; // rough estimate
  console.log(`✓  Catalogue written → ${OUT_PATH}`);
  console.log(
    `   ${COLLECTIONS.length} collections · ${Object.values(catalog).flatMap(Object.values).flat().length} products`
  );
  console.log(`   Approx ${totalSlides}+ slides`);
}

generate().catch((err: unknown) => {
  console.error('Catalogue generation failed:', err);
  process.exit(1);
});
