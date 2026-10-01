import { defineConfig } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { imagetools } from 'vite-imagetools';
import { VitePWA } from 'vite-plugin-pwa';
// Explicit `.ts` extension: this file is type-checked under `moduleResolution:
// nodenext`, which requires one on a relative import.
import { catalogDevApi } from './scripts/catalogDevApi.ts';

/**
 * Base public path. Empty in dev; set by CI per deploy target, e.g. /lumora-flames/ for GitHub Pages.
 * because the same commit is publised to three different paths:
 *
 * local dev -> /
 * production -> /Lumora-Flames/
 * PR preview -> /Lumora-Flames/pr-12/
 *
 * Vite re-exports this as `import.meta.env.BASE_URL`, which the router reads as
 * its `basename` - so this one variable is the single source of truth for the
 * path prefix and the two cannot drift apart.
 */

const base = process.env.VITE_BASE_PATH ?? '/';

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    /*
     * Derives the responsive widths in `src/data/assets.ts` from the WebP masters.
     *
     * Format conversion is *not* this plugin's job here — `scripts/convertImages.mjs`
     * already produced the WebP masters, and uploads are converted on arrival by
     * `catalogDevApi`. What this adds is the one thing neither of those can: several
     * *widths* of each image, so a 390px phone downloads a 640px file instead of a
     * 1344px one. That is the half of the problem a format change cannot touch, because
     * a decoded bitmap costs `w × h × 4` bytes of memory whatever the codec.
     */
    imagetools(),
    /*
     * Write API for the local-only CMS at /update-list. Declares `apply: 'serve'`
     * internally, so it is never instantiated for a production build - see
     * scripts/catalogDevApi.ts for why that is a safety boundary and not a tweak.
     */
    catalogDevApi(),

    /*
     * Service worker with a `prompt` update strategy: after a new deploy the user
     * sees a small "Update available" banner and taps to reload — the old app is
     * never silently swapped under them, which is the failure mode that makes SW
     * riskier than it sounds on a site with no versioned API.
     *
     * `devOptions.enabled: false` keeps the SW out of `vite serve` entirely.
     * HMR and the CMS write API both break with a SW intercepting requests, and
     * `apply: 'serve'` already separates build from serve for the API — the SW
     * follows the same discipline.
     *
     * Cache scope: all JS/CSS chunks, all WebP/JPEG images, HTML shell. Workbox
     * uses a cache-first strategy for pre-cached assets (hashed filenames) and
     * stale-while-revalidate for the HTML shell. On a slow network, repeat visits
     * load from disk — zero bytes over the wire.
     */
    VitePWA({
      registerType: 'prompt',
      devOptions: { enabled: false },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'og.jpg'],
      manifest: {
        name: 'Lumora Flames',
        short_name: 'Lumora',
        description:
          'Small-batch candles poured by hand: festive urlis and diyas, bespoke fragrance blends, food-mimicking wax sculptures.',
        theme_color: '#f59e0b',
        background_color: '#0c0a09',
        display: 'standalone',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,webp,jpeg,jpg,svg,woff2,woff}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
