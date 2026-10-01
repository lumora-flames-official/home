import { defineConfig } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { imagetools } from 'vite-imagetools';
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
  ],
});
