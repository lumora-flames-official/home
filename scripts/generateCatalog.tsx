/* eslint-disable react-refresh/only-export-components */
/**
 * Generates public/catalog.pdf from src/data/catalog.json.
 *
 * Run manually:  npx tsx scripts/generateCatalog.tsx
 * In CI:         triggered by catalog-export.yml on catalog.json / catalog-images changes.
 *
 * Layout: dark cover → collection divider → one product per page (light) → commission back.
 * Designed for import into Gamma / Canva for final PPTX production.
 */

import React from 'react';
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { formatPrice } from '../src/lib/formatPrice.ts';
import type { CatalogData, StoredProduct } from '../src/types/catalog.ts';

const __filename = fileURLToPath(import.meta.url);
const __dir = dirname(__filename);
const ROOT = join(__dir, '..');
const IMG_DIR = join(ROOT, 'src', 'data', 'catalog-images');
const OUT_PATH = join(ROOT, 'public', 'catalog.pdf');

// Inlined — contact.ts uses import.meta.env.DEV which does not exist in Node.
const CONTACT = {
  whatsapp: '+91 98733 01173',
  instagram: '@lumora_flames',
  site: 'lumora-flames-official.github.io/home',
} as const;

const COLLECTIONS = [
  { id: 'bespoke-personalized', title: 'Bespoke & Personalized', tagline: 'Made to your memory' },
  {
    id: 'traditional-festive',
    title: 'Traditional & Festive',
    tagline: 'Sacred flames for auspicious moments',
  },
  { id: 'sculptural-decorative', title: 'Sculptural & Decorative', tagline: 'Art you can light' },
  { id: 'speciality-wax', title: 'Specialty Wax', tagline: 'Texture and character in every curve' },
  {
    id: 'container-jar',
    title: 'Container & Jar',
    tagline: 'Long-burning ambience in every vessel',
  },
  { id: 'raw-materials', title: 'Raw Materials', tagline: 'For the candle maker in you' },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toTitle = (slug: string): string =>
  slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

const imgPath = (categoryId: string, product: StoredProduct): string =>
  join(IMG_DIR, categoryId, product.image);

// ─── Colour palette ───────────────────────────────────────────────────────────

const C = {
  amber: '#F59E0B',
  dark: '#1C1917', // stone-900 — dark pages
  panel: '#292524', // stone-800 — content bg on dark pages
  white: '#FAFAF9',
  body: '#292524', // product name, body text
  muted: '#78716C', // SKU, sub-text
  subtle: '#D6D3D1', // dividers
  offwhite: '#F5F5F4', // product page background
  stoneHdr: '#A8A29E', // muted headers on dark bg
} as const;

// ─── Styles ───────────────────────────────────────────────────────────────────

// A4 landscape: 841.89 × 595.28 pt
const IMG_COL_W = 442; // ~52 % of 842

const s = StyleSheet.create({
  // ── Cover page ───────────────────────────────────────────────────────────────
  coverPage: {
    backgroundColor: C.dark,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 56,
  },
  coverLumora: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 62,
    color: C.amber,
    letterSpacing: 10,
    marginBottom: 2,
  },
  coverFlames: {
    fontFamily: 'Helvetica',
    fontSize: 32,
    color: C.stoneHdr,
    letterSpacing: 7,
    marginBottom: 22,
  },
  coverRule: { width: 80, height: 2, backgroundColor: C.amber, marginBottom: 22 },
  coverTagline: {
    fontFamily: 'Helvetica',
    fontSize: 11,
    color: '#D6D3D1',
    letterSpacing: 2,
    marginBottom: 6,
  },
  coverYear: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: C.muted,
    letterSpacing: 1,
    marginTop: 30,
  },

  // ── Collection divider ────────────────────────────────────────────────────────
  divPage: {
    backgroundColor: C.dark,
    flexDirection: 'column',
    justifyContent: 'center',
    paddingHorizontal: 64,
    paddingVertical: 56,
  },
  divIndex: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: C.amber,
    letterSpacing: 2,
    marginBottom: 10,
  },
  divTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 42,
    color: C.white,
    lineHeight: 1.1,
    marginBottom: 14,
  },
  divRule: { width: 56, height: 2, backgroundColor: C.amber, marginBottom: 12 },
  divTagline: {
    fontFamily: 'Helvetica',
    fontSize: 13,
    color: C.stoneHdr,
    marginBottom: 10,
  },
  divCount: { fontFamily: 'Helvetica', fontSize: 9, color: C.muted },

  // ── Product page ──────────────────────────────────────────────────────────────
  productPage: {
    backgroundColor: C.offwhite,
    flexDirection: 'row',
  },

  // Left image column
  imgCol: {
    width: IMG_COL_W,
    height: '100%',
    overflow: 'hidden',
    backgroundColor: '#E7E5E4',
  },
  img: {
    width: IMG_COL_W,
    height: '100%',
    objectFit: 'cover',
  },
  imgPlaceholder: {
    width: IMG_COL_W,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imgPlaceholderText: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: C.muted,
  },

  // Right content column
  contentCol: {
    flex: 1,
    flexDirection: 'column',
    paddingTop: 38,
    paddingHorizontal: 34,
    paddingBottom: 28,
    borderLeftWidth: 1,
    borderLeftColor: C.subtle,
  },

  eyebrow: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: C.amber,
    letterSpacing: 1.4,
    marginBottom: 14,
  },
  productName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 24,
    color: C.body,
    lineHeight: 1.25,
    marginBottom: 16,
  },
  price: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 22,
    color: C.amber,
    marginBottom: 6,
  },
  sku: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: C.muted,
    letterSpacing: 0.8,
    marginBottom: 20,
  },
  fragranceLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: C.muted,
    letterSpacing: 1.2,
    marginBottom: 7,
  },
  fragranceNote: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: C.body,
    lineHeight: 1.55,
    marginBottom: 2,
  },
  dividerLine: {
    height: 1,
    backgroundColor: C.subtle,
    marginVertical: 18,
  },

  // Footer
  footerSpacer: { flex: 1 },
  footerNote: {
    fontFamily: 'Helvetica',
    fontSize: 7.5,
    color: C.muted,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  footerSite: {
    fontFamily: 'Helvetica',
    fontSize: 7,
    color: C.subtle,
    letterSpacing: 0.4,
  },

  // ── Commission back page ──────────────────────────────────────────────────────
  backPage: {
    backgroundColor: C.dark,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 56,
  },
  backTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 34,
    color: C.white,
    marginBottom: 10,
  },
  backSub: {
    fontFamily: 'Helvetica',
    fontSize: 11,
    color: C.stoneHdr,
    marginBottom: 20,
  },
  backRule: { width: 56, height: 2, backgroundColor: C.amber, marginBottom: 20 },
  backContact: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    color: C.amber,
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  backHandle: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: C.stoneHdr,
    marginBottom: 5,
  },
  backSite: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: C.muted,
    marginTop: 10,
  },
});

// ─── Page components ──────────────────────────────────────────────────────────

const CoverPage: React.FC = () => (
  <Page size="A4" orientation="landscape" style={s.coverPage}>
    <Text style={s.coverLumora}>LUMORA</Text>
    <Text style={s.coverFlames}>FLAMES</Text>
    <View style={s.coverRule} />
    <Text style={s.coverTagline}>ARTISANAL CANDLE COLLECTION</Text>
    <Text style={s.coverYear}>{new Date().getFullYear()}</Text>
  </Page>
);

const CollectionDividerPage: React.FC<{
  collection: (typeof COLLECTIONS)[number];
  index: number;
  count: number;
}> = ({ collection, index, count }) => (
  <Page size="A4" orientation="landscape" style={s.divPage}>
    <Text style={s.divIndex}>{String(index + 1).padStart(2, '0')}</Text>
    <Text style={s.divTitle}>{collection.title}</Text>
    <View style={s.divRule} />
    <Text style={s.divTagline}>{collection.tagline}</Text>
    <Text style={s.divCount}>
      {count > 0
        ? `${count} ${count === 1 ? 'candle' : 'candles'} listed`
        : 'Available on bespoke order'}
    </Text>
  </Page>
);

const ProductPage: React.FC<{
  product: StoredProduct;
  categoryId: string;
  categoryTitle: string;
  varietyName: string;
}> = ({ product, categoryId, categoryTitle, varietyName }) => {
  const src = imgPath(categoryId, product);
  const hasImage = existsSync(src);

  return (
    <Page size="A4" orientation="landscape" style={s.productPage}>
      {/* Left: product image */}
      <View style={s.imgCol}>
        {hasImage ? (
          <Image src={src} style={s.img} />
        ) : (
          <View style={s.imgPlaceholder}>
            <Text style={s.imgPlaceholderText}>No image</Text>
          </View>
        )}
      </View>

      {/* Right: content */}
      <View style={s.contentCol}>
        <Text style={s.eyebrow}>
          {categoryTitle.toUpperCase()} · {varietyName.toUpperCase()}
        </Text>

        <Text style={s.productName}>{product.name}</Text>
        <Text style={s.price}>{formatPrice(product.priceInr)}</Text>
        <Text style={s.sku}>{product.sku}</Text>

        {product.fragrance.length > 0 && (
          <>
            <Text style={s.fragranceLabel}>FRAGRANCE</Text>
            {product.fragrance.map((note, i) => (
              <Text key={i} style={s.fragranceNote}>
                ◦ {note}
              </Text>
            ))}
          </>
        )}

        <View style={s.dividerLine} />

        {/* Footer */}
        <View style={s.footerSpacer} />
        <Text style={s.footerNote}>Poured to order. Quote the SKU when enquiring.</Text>
        <Text style={s.footerSite}>{CONTACT.site}</Text>
      </View>
    </Page>
  );
};

const CommissionPage: React.FC = () => (
  <Page size="A4" orientation="landscape" style={s.backPage}>
    <Text style={s.backTitle}>Commission Your Candle</Text>
    <Text style={s.backSub}>Every candle is poured to order in small batches.</Text>
    <View style={s.backRule} />
    <Text style={s.backContact}>WhatsApp · {CONTACT.whatsapp}</Text>
    <Text style={s.backHandle}>Instagram · {CONTACT.instagram}</Text>
    <Text style={s.backSite}>{CONTACT.site}</Text>
  </Page>
);

// ─── Document ─────────────────────────────────────────────────────────────────

const CatalogDocument: React.FC<{ catalog: CatalogData }> = ({ catalog }) => (
  <Document
    title="Lumora Flames — Artisanal Candle Catalogue"
    author="Lumora Flames"
    subject="Product catalogue for commission enquiries"
  >
    <CoverPage />

    {COLLECTIONS.map((col, index) => {
      const catData = catalog[col.id] ?? {};
      const allProducts = Object.values(catData).flat();

      return (
        <React.Fragment key={col.id}>
          <CollectionDividerPage collection={col} index={index} count={allProducts.length} />
          {Object.entries(catData).flatMap(([varietyId, products]) =>
            products.map((product) => (
              <ProductPage
                key={product.sku}
                product={product}
                categoryId={col.id}
                categoryTitle={col.title}
                varietyName={toTitle(varietyId)}
              />
            ))
          )}
        </React.Fragment>
      );
    })}

    <CommissionPage />
  </Document>
);

// ─── Main ─────────────────────────────────────────────────────────────────────

async function generate(): Promise<void> {
  const catalog = JSON.parse(
    readFileSync(join(ROOT, 'src', 'data', 'catalog.json'), 'utf-8')
  ) as CatalogData;

  const totalProducts = Object.values(catalog).flatMap(Object.values).flat().length;

  const buffer = await renderToBuffer(<CatalogDocument catalog={catalog} />);
  writeFileSync(OUT_PATH, buffer);

  console.log(`✓  Catalogue written → ${OUT_PATH}`);
  console.log(`   6 collections · ${totalProducts} products`);
}

generate().catch((err: unknown) => {
  console.error('Catalogue generation failed:', err);
  process.exit(1);
});
