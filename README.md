# Lumora Flames

Marketing and catalog site for a handcrafted artisanal candle brand — festive urlis and
diyas, bespoke fragrance blends, food-mimicking wax sculptures, and raw materials for DIY
candle makers.

React 19 · Vite 8 · Tailwind v4 · GSAP · deployed to GitHub Pages.

```bash
export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"   # Node 12 is the machine default and breaks every script
npm install
npm run dev
```

Both deploy workflows gate on all four of `lint`, `format:check`, `test` and `build`. Run
them before pushing, not just `build`.

---

## The five decisions that explain this codebase

If you read nothing else, read these. Each one looks like a mistake until you know why.

### 1. There is no backend, and that is a product decision

No cart, no checkout, no inquiry form. The conversion path is a **WhatsApp deep link**: a
visitor taps "Commission", WhatsApp opens with the product name, price and SKU already
typed, and the enquiry lands in the studio's inbox.

An inquiry form, OTP verification and a `VerificationProvider` seam all existed once and
were deleted deliberately — a form needing a server, a database and a verified phone number
was more infrastructure than the enquiry volume justified.

Two consequences worth internalising:

- **`src/data/contact.ts` is the only source of handles, numbers and studio facts.** A
  number that is right in the footer and stale on the contact page is worse than no
  number. Unfilled values use a `PLACEHOLDER` sentinel and are hidden rather than rendered.
- **The test suite covers exactly one thing: those links.** Not because the rest doesn't
  matter, but because this is the only failure that is *silent* — a malformed number makes
  `wa.me` open an "invalid number" screen rather than throwing, so a typo still looks like
  a working button. Everything else fails visibly. Treat manual verification as the real
  safety net; see [`docs/architecture.md#verifying-a-change`](docs/architecture.md#verifying-a-change).

`src/lib/productActions.ts` resolves an *intent* (`{ kind: 'link', href }`) rather than
handling the click, so a card renders an `<a>` for something that leaves the site and a
`<button>` for something that doesn't. That is also the seam a cart would land in.

### 2. The file system is the database

No CMS service, no runtime fetch. Product data lives in `src/data/catalog.json` and
photographs in `src/data/catalog-images/`, both **written by tooling, never by hand**:

```
/update-list  →  scripts/catalogDevApi.ts  →  catalog.json + catalog-images/  →  git commit
   (panel)         (Vite dev middleware)           (the repository)              (publish)
```

`scripts/catalogDevApi.ts` is a Vite plugin declaring **`apply: 'serve'`**. That is a
safety boundary, not an optimisation: these handlers write to the repository, so what
matters is that they *cannot* exist in a built artifact — Vite never instantiates the
plugin for `vite build`. The panel is separately gated on `import.meta.env.DEV` in
`App.tsx`, so it is tree-shaken out of the bundle entirely; **that** gate is the one doing
the real work. The panel's `window.location.hostname` check is a third layer for an honest
misconfiguration only — shipped code can be read and skipped, so don't mistake it for the
guard.

Uploads are **converted to WebP and capped at 1600px on arrival**, inside those handlers.
The studio picks a 3 MB phone photo and ~150 KB lands in the repository; nobody has to
learn what a codec is.

Two invariants the write API enforces, and why:

- **A SKU is minted once and never recomputed.** It has already been quoted in WhatsApp
  enquiries the studio has received.
- **A product's collection and variety cannot be edited.** The SKU encodes both
  (`BESPOKE-V1-03`), so a move would either renumber a live product code or leave a SKU
  that lies about where the product sits. Re-filing is delete-and-re-add, which correctly
  issues a new code. Name, price, fragrance notes and photos *are* all editable.

A product carries a cover `image` plus optional `images` for the gallery in
`ProductDialog`. Separate fields rather than one array, because the cover is the only image
a grid tile shows — making it "element zero" would turn losing it into an off-by-one
instead of a type error.

### 3. Images are imported, never referenced as path strings

The trap most likely to catch a new contributor, because **it breaks in production only**.

The site deploys under a base prefix — `/home/` in production, `/home/pr-N/` for previews
— but `base` is `/` in dev. So a stored `"/images/candle.webp"` resolves above the deploy
root and 404s live while looking perfect locally. Content hashing is lost too, so replacing
a photo under the same filename serves the stale one from cache.

Two mechanisms, both verified at build time:

| | For | How |
| --- | --- | --- |
| `src/data/assets.ts` | Hand-authored photography | Named `import`s, so a missing file fails the build |
| `src/data/catalogImages.ts` | CMS-written photos | `import.meta.glob` over a directory — nobody hand-writes 40 imports |

For the record, since it is a common assumption: an `import` does **not** inline or bundle
an image. Vite emits a separate hashed file and the import resolves to a URL string, so
forty imports cost forty short strings.

`assets.ts` imports carry a `?w=640;1024;1344&as=picture` suffix, so `vite-imagetools`
emits three widths of each and the value is a `ResponsivePicture`, not a URL. Render it
through `ResponsiveImage` and **give it a real `sizes`** — see
[`docs/performance.md`](docs/performance.md) for why that attribute is load-bearing and how
it fails silently.

`scripts/convertImages.mjs` converts hand-added photography to WebP and regenerates
`public/og.jpg`. Run by hand, never in CI.

### 4. Two views of the same content, linked at the reader's position

```
/                      Landing — full-bleed, opts out of PageShell
/collections           One continuous journey: 6 pinned collections × their varieties
/catalog               One collection at a time: products, prices, SKUs
/about  /contact
/update-list           Dev-only CMS
/category/:id          Retired → redirects into /collections
```

`/collections` says what a variety *is*; `/catalog` says what you can actually have. They
link into each other **at the reader's current position**, through a
`#<categoryId>/<varietyId>` hash defined once in `src/lib/deepLink.ts`.

A hash and not a path segment, for a specific reason: `PageTransition` scrolls to top and
replays its enter tween on every `pathname` change, so a tab navigating to
`/collections/specialty-wax` would reset the scroll it was supposed to move. A hash change
leaves `pathname` untouched.

`/catalog` renders **one collection at a time** — over-scrolling past either end pages to
the adjacent stocked collection (`useTabOverscroll`, which measures input intent rather
than scroll position, for reasons its JSDoc explains). Don't go back to rendering all of
them at once.

`CANDLE_CATEGORIES` in `src/data/categories.ts` is the source of truth. **Ids are URL
slugs**, they are the keys in `catalog.json`, and they are `PromoSlide.targetCollectionId`.
Renaming one breaks live links silently — which is why `assertCatalogResolves()` and
`assertTargetsResolve()` throw in dev.

### 5. Motion is GSAP, and every animated component has a reduced-motion branch

Always inside `useGSAP(() => {...}, { scope: ref, dependencies: [...] })` — never
`useEffect` plus raw gsap. Animate transforms and opacity, never layout properties. Under
reduced motion, skip the pin, skip the autoplay, and `clearProps` so nothing is stranded
invisible.

`/collections` carries no photography at all: six radial light pools plus `EmberField` over
the page's own surface. That started as a performance decision (11.39 MB → 0) and turned
out to look better, and it is why `VarietyStage` uses ordinary themed colour rather than
the white-on-photograph it did before.

---

## Where to read next

| Task | Read |
| --- | --- |
| **Writing any code** — JSDoc standard, DRY rules, naming, accessibility | [`docs/architecture.md#coding-rules`](docs/architecture.md#coding-rules) |
| Adding a route, component or feature | [`docs/architecture.md#where-a-new-file-goes`](docs/architecture.md#where-a-new-file-goes) |
| Anything touching images, bundle size, or "will this be slow" | [`docs/performance.md`](docs/performance.md) |
| Any visual work — colour, type, spacing, motion, glass | [`docs/design-system.md`](docs/design-system.md) |
| Adding or pricing candles; the `/update-list` write API | [`docs/architecture.md#the-publishing-constraint`](docs/architecture.md#the-publishing-constraint), then `src/data/catalog.ts` and `scripts/catalogDevApi.ts` |
| Building a promotional carousel | [`docs/promoCarousal.md`](docs/promoCarousal.md) |

`CLAUDE.md` holds the full list of hard rules in one place.

## Scripts

```bash
npm run dev                          # dev server, plus /update-list and its write API
npm run build                        # tsc -b && vite build
npm run lint                         # eslint
npm run test                         # vitest run — WhatsApp links and deep-link parsing
npm run format:check                 # prettier --check .
node scripts/convertImages.mjs       # dry run: report what it would convert
node scripts/convertImages.mjs --write
```

`catalog.json` is **not** in `.prettierignore`, so `format:check` covers it — which is why
the write middleware runs Prettier on every write. `JSON.stringify(…, null, 2)` alone is
not Prettier-clean: it expands short arrays that Prettier keeps on one line, and the red
check would land on the *next* push looking unrelated to having added a product.

## Known gaps

- **Collection copy and imagery still require a developer.** Products are self-service
  through `/update-list`; collection titles, taglines, the 19 variety descriptions, promo
  slides, contact facts and `AboutStory`'s `PROCESS_STEPS`/`PILLARS` all live in source.
  Extending the CMS to cover them is planned and would reuse `catalogDevApi.ts` wholesale
  — with ids held immutable, exactly as SKUs are.
- The four `STUDIO` facts in `src/data/contact.ts` are still `PLACEHOLDER`, so the studio
  panel on `/contact` is skipped. A copy task, not a code one.
- Enquiries are recorded nowhere but the studio's WhatsApp and Instagram inboxes. No log,
  no lead list, no analytics on the conversion path. Accepted deliberately.
- No service worker, so repeat visits revalidate rather than hit cache — GitHub Pages sends
  `max-age=600` and offers no header control. See [`docs/performance.md`](docs/performance.md).
- The catalog is nearly empty: four products across nineteen varieties, so three of the six
  collection tabs show a commission prompt instead of a grid. Correct behaviour, not a bug.
- `/update-list` has no auth and no undo. It doesn't need auth — it only exists on
  localhost while `vite serve` runs — but a delete removes the photo from disk immediately.
  Git is the undo.
- No SEO beyond the title, description and Open Graph card in `index.html`.
- There is still no cart. `resolveProductAction` is the seam: adding `'add_to_cart'` means
  one new `case` returning a `command` intent, which `ProductCard` already renders.
