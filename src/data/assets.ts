/**
 * Image asset registry for Lumora Flames.
 *
 * Images are imported (not referenced by string path) so Vite fingerprints them,
 * bundles them, and fails the build if a file goes missing. To swap a photo,
 * drop the new file into `src/data/images/**` and update the import below.
 */

// Brand marks. `flameMark` is the traced vector of the logo flame — the same
// artwork as `public/favicon.svg`, kept here as an import so in-page use is
// fingerprinted. Edit both if the mark ever changes.
import flameMark from './images/logo/flame-mark.svg';

// Collection hero imagery
import bespoke from './images/collections-landing/bespoke.webp?w=640;1024;1344&as=picture';
import jarCandles from './images/collections-landing/jarCandles.webp?w=640;1024;1344&as=picture';
import sculptural from './images/collections-landing/Sculptural_Decorative.webp?w=640;1024;1344&as=picture';
import traditional from './images/collections-landing/Traditional_Festive.webp?w=640;1024;1344&as=picture';
import specialtyWax from './images/collections-landing/Speciality_Candles.webp?w=640;1024;1344&as=picture';
import rawMaterial from './images/collections-landing/rawMaterial.webp?w=640;1024;1344&as=picture';

// Promotional carousel imagery
import beveragesCocktails from './images/deserts_beverages/Beverages_cocktails.webp?w=640;1024;1344&as=picture';
import desserts from './images/deserts_beverages/desserts.webp?w=640;1024;1344&as=picture';
import smoothie from './images/deserts_beverages/Smoothie.webp?w=640;1024;1344&as=picture';

export const ASSET_IMAGES = {
  brand: {
    flameMark,
  },
  categories: {
    bespoke,
    containerJar: jarCandles,
    sculptural,
    traditional,
    specialtyWax,
    rawMaterials: rawMaterial,
  },
  promotional_one: {
    first: beveragesCocktails,
    second: desserts,
    third: smoothie,
  },
} as const;
