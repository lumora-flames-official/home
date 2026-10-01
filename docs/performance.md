# Performance

What this site costs to load and to run, how those numbers were obtained, and which
theories about them turned out to be wrong.

It exists because the site is served from GitHub Pages with no server, no analytics and no
error reporting. There is no telemetry to consult, so a regression is invisible unless
someone re-measures. This document is what "re-measure" means.

## Baseline and current

Measured against `npx vite preview` on localhost, cold cache, headless Chrome 153,
`deviceScaleFactor: 1`. "Scrolled" means one full traversal of the page in 40 steps.

**Before** is the state at the start of the September 2026 performance pass, when the
nine hand-authored photographs were PNG. **After** is with WebP masters, `srcset`
variants, and the photographs removed from `/collections`.

| Route | Transfer | Images | JS+CSS | Decoded bitmaps | JS heap |
| --- | --- | --- | --- | --- | --- |
| `/` first view — before | 7.07 MB | 6.89 MB | 0.18 MB | 16.5 MB | 7.4 MB |
| `/` first view — **after** | **0.42 MB** | 0.23 MB | 0.19 MB | 9.2 MB | 6.8 MB |
| `/` scrolled — before | 15.91 MB | 15.72 MB | 0.18 MB | **60.8 MB** | 13.3 MB |
| `/` scrolled @1440 — **after** | **0.68 MB** | 0.49 MB | 0.19 MB | **16.4 MB** | 8.9 MB |
| `/` scrolled @390 — **after** | **0.54 MB** | 0.35 MB | 0.19 MB | **3.0 MB** | 8.9 MB |
| `/collections` scrolled — before | 11.55 MB | 11.39 MB | 0.16 MB | 28.3 MB | 46.4 MB |
| `/collections` scrolled — **after** | **0.16 MB** | **0.00 MB** | 0.16 MB | **0.0 MB** | 31.2 MB |
| `/catalog` — before | 0.38 MB | 0.21 MB | 0.16 MB | 2.1 MB | 4.5 MB |
| `/catalog` — **after** | 0.30 MB | 0.14 MB | 0.16 MB | 2.1 MB | 4.2 MB |

`dist/` went from **20 MB to 3.3 MB**. `/catalog` barely moved and is the control: it was
already correct, so a change there would have meant something else broke.

## The three things worth understanding

**Bundle size was never the problem.** JS and CSS total 640 KB for the entire app, and
`catalog.json` is 1.3 KB — roughly 120 KB at 500 products. 97% of the deployed site was
nine PNG files. Code splitting is already done (15 chunks, one per route via
`React.lazy`); the 403 KB entry is React + react-dom + router + GSAP, which every route
needs, so splitting it further only adds round-trips. **Do not reopen bundle size without
a measurement showing it matters.**

**Format and dimensions are separate axes, and only one of them is about memory.** WebP
cut transfer ~16×. It did nothing for decoded bitmaps, because a bitmap costs
`width × height × 4` bytes regardless of codec. The 60.8 MB → 16.4 MB (desktop) and
3.0 MB (phone) came entirely from `srcset` serving a smaller *image*, via
`ResponsiveImage`. On a low-RAM device that is the number that decides whether the tab
survives, so **a `sizes` attribute is not a nicety** — omit it and the browser assumes
`100vw`, silently fetches the largest variant, and the page still looks perfect.

**A gradient cannot be blurry.** `/collections` carried six dimmed photographs behind
text. Replacing them with a radial light pool and `EmberField` took the route to 0.16 MB
and zero bitmaps — better than WebP could ever have got it — and removed the whole class
of "does this look soft on a retina display" question. See `CollectionsJourney`'s
`LIGHT_POOLS`.

## Two hypotheses that did not survive measurement

Recorded because both are the standard advice, both sound right, and both were wrong here.

**"`/collections` does 5,215 layouts, so it is layout-thrashing."** LayoutCount is a bad
proxy. The same traversal spends **0.16 s** in layout. Measuring main-thread work
directly — `ScriptDuration + LayoutDuration + RecalcStyleDuration` over one full
traversal — gives:

| Route | Script | Layout | Style | Busy | Main thread |
| --- | --- | --- | --- | --- | --- |
| `/collections` | 0.384 s | 0.035 s | 0.157 s | 0.58 s / 6.6 s | **9%** |
| `/` | 0.251 s | 0.037 s | 0.181 s | 0.47 s / 6.6 s | **7%** |
| `/catalog` | 0.039 s | 0.000 s | 0.024 s | 0.06 s / 6.6 s | **1%** |

Nine percent is not a CPU problem. The GSAP pinning, the six infinite decorative tweens
and the procedural candle are all affordable. `anticipatePin: 1` was tried and reverted —
no measured benefit, and it adds work.

**"`will-change: transform` will fix it."** It cannot. The layouts come from `pin: true`
— ScrollTrigger re-measuring the document — not from animating a layout property, which
nothing in this codebase does. `will-change` also promotes each element to its own
compositor layer and reserves GPU memory, the exact resource a low-end device lacks, so
applied broadly it makes scrolling worse. There is deliberately none in the codebase.

`ScrollTrigger.config({ limitCallbacks: true })` is set in `src/main.tsx` and **also did
not reduce layout work** (2,808 → 2,859 over an identical 60-step traversal, i.e. noise).
It is kept on principle, not as a win. `ignoreMobileResize` in the same call does earn its
place: it stops a full six-pin refresh when a phone's toolbar slides away.

One real finding did come out of the GPU question: `playEntrance`'s `clip` case animated
`clipPath`, which is not a compositor property and repaints every frame. It is now a
`scaleX` wipe with a counter-scaled child, which looks the same and is free.

## Budgets

Hold these. A change that breaks one needs a number justifying it.

| Budget | Limit | Headroom today |
| --- | --- | --- |
| Any route, first view | ≤ 1 MB | `/` at 0.42 MB |
| Any route, fully scrolled | ≤ 2 MB | `/` at 0.68 MB |
| JS + CSS total | ≤ 700 KB | 640 KB — **thin** |
| Decoded bitmaps, phone | ≤ 8 MB | `/` at 3.0 MB |
| Main thread during scroll | ≤ 25% | `/collections` at 9% |

JS+CSS is the tight one. GSAP plugins are the usual cause: `Draggable` + `InertiaPlugin`
are ~117 KB of source and must stay dynamically imported (see `CLAUDE.md`).

## The GitHub Pages ceiling

Concurrency is a non-question — Pages is served by Fastly's CDN, and 10,000 simultaneous
readers of static files is nothing. There is no origin of ours to overload.

The binding limit is the **100 GB/month soft bandwidth cap** (alongside a 1 GB site size
limit and 10 builds/hour):

| | Per first visit | First visits/month before GitHub emails you |
| --- | --- | --- |
| Before this pass | ~7 MB | ~14,000 |
| **Now** | ~0.45 MB | **~220,000** |

So the optimisation *was* the scaling plan; there is no separate scaling project. Beyond
220,000, putting Cloudflare in front of Pages is free and removes the ceiling.

**Caching is not ours to control.** Pages sends `Cache-Control: max-age=600` on
everything and offers no header configuration. Vite's content hashing means the *content*
is immutable, but the browser still revalidates every 10 minutes — cheap 304s, not cache
hits. The only way to get genuinely long-lived caching here is a service worker
(cache-first on hashed `/assets/*`, network-first on `index.html`), which would roughly
halve repeat-visit bandwidth again. Deliberately **not** done yet: a misconfigured service
worker pins a stale app on customer devices with no way to push a fix, so it needs its own
pass with `vite-plugin-pwa` and verification on a deployed preview.

## Known costs, accepted

- **`backdrop-blur` is the most expensive thing in the stylesheet.** 13 `backdrop-blur-*`
  and 4 `blur-3xl`. Backdrop filters on large fixed elements are genuinely heavy on weak
  GPUs — and they are the navbar pill, the catalog toolbar and every glass card, i.e. the
  brand's entire look. Measured and named rather than stripped. If a low-end device ever
  does struggle, this is the first thing to test, not the animations.
- **`Smoothie.webp` is 1920px wide but variants stop at 1344px.** The width list
  `640;1024;1344` is shared by all nine masters and the narrowest is 1344
  (`jarCandles`), so a common list cannot go higher without upscaling seven of them.
  Costs slight sharpness on one promo background on very large displays.
- **Catalog photography is not run through `imagetools`.** CMS uploads are already
  converted and capped at 1600px on arrival by `catalogDevApi`, and `/catalog` paginates
  by collection, so the route stays flat as products are added. Revisit if a single
  collection ever holds dozens of listings.

## How to reproduce

```bash
export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"
npm run build
npx vite preview --port 4173

# separate shell
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --remote-debugging-port=9222 \
  --user-data-dir=/tmp/cdp/profile --no-first-run about:blank
```

Then drive it over the DevTools Protocol:

- **Transfer**, split by resource type — sum `Network.loadingFinished.encodedDataLength`,
  grouped by the `type` from the matching `Network.responseReceived`.
- **Decoded bitmaps** — `[...document.images].reduce((t,i) => t + i.naturalWidth * i.naturalHeight, 0) * 4`.
- **Main-thread work** — `Performance.getMetrics` before and after a scripted scroll, then
  difference `ScriptDuration`, `LayoutDuration` and `RecalcStyleDuration`.
- **Which variant was served** — `[...document.images].map(i => i.currentSrc)`. At 390 px
  these must be the `640w` files. This is the only check that catches a wrong `sizes`,
  because the failure is invisible.

Two traps, both of which produced wrong conclusions during this pass:

- **Do not measure frame rate in headless Chrome.** It pins `requestAnimationFrame` to
  30 Hz, so every route reports a flat 33.3 ms regardless of load — `/catalog` unthrottled
  reads identically to `/collections` at 4× CPU throttling. Use main-thread duration
  instead, which is load-proportional.
- **LayoutCount depends on how you scroll.** Comparing a before and after taken with
  different step counts is meaningless. Fix the driver script first.

For contrast checking, resolve colours by painting them into a 1×1 canvas and reading the
pixel back. Tailwind v4 emits `oklch()`, and parsing its three numbers as RGB produces
plausible-looking nonsense.
