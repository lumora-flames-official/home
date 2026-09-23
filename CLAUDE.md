# CLAUDE.md

Lumora Flames — marketing & catalog site for a handcrafted artisanal candle brand (festive urlis and diyas, bespoke fragrance blends, food-mimicking wax sculptures, and raw materials for DIY candle makers). No cart, no checkout, and no inquiry form; the conversion path is a direct message, via the WhatsApp and Instagram links at `/contact`.

React 19 + Vite 8 + Tailwind v4 + GSAP. No backend. Tests cover one thing only — the WhatsApp deep link — so treat manual verification as the real safety net.

## Which doc to read when

Read the relevant doc **before** writing code — don't infer conventions from a single nearby file.

| Task | Read |
| --- | --- |
| Building or restyling a promotional carousel; needing design concepts for one | [`docs/promoCarousal.md`](docs/promoCarousal.md) |
| **Writing any code at all** — the JSDoc standard, the DRY rules, naming, motion, accessibility, and how a change is verified | [`docs/architecture.md#coding-rules`](docs/architecture.md#coding-rules) |
| Adding a route, component, or feature; deciding where a new file belongs | [`docs/architecture.md#where-a-new-file-goes`](docs/architecture.md#where-a-new-file-goes) |
| Understanding how a screen, CTA, or piece of content connects to the rest | [`docs/architecture.md#navigation-tree`](docs/architecture.md#navigation-tree) |
| Anything touching how content is edited or published, or the admin-panel plan | [`docs/architecture.md#the-publishing-constraint`](docs/architecture.md#the-publishing-constraint) |
| Adding, listing or pricing individual candles; touching the `/update-list` CMS or its write API | [`docs/architecture.md#the-publishing-constraint`](docs/architecture.md#the-publishing-constraint), then `src/data/catalog.ts` and `scripts/catalogDevApi.ts` |
| Any visual work — colour, type, spacing, motion, glass surfaces | [`docs/design-system.md`](docs/design-system.md) |

For a small change inside one existing component, matching that file's surrounding style is enough. For anything new, or anything visual, read the docs first.

## Running things

**Node v12 is the machine default and breaks every script** with a bare `Unexpected token ?`. Use Node 24:

```bash
export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"
```

```bash
npm run dev           # vite dev server — also serves /update-list and its write API
npm run build         # tsc -b && vite build
npm run lint          # eslint
npm run test          # vitest run
npm run format:check  # prettier --check .
```

**Adding products** is `npm run dev`, then `/update-list`. That panel and its `/api/catalog` endpoints exist *only* under `vite serve`; a build has neither. It writes to `src/data/catalog.json` and `src/data/catalog-images/`, so the changes show up in `git status` and go live when you push.

**Both deploy workflows gate on all four of `lint`, `format:check`, `test` and `build`** — a failure in any one of them means no deploy, so run them before pushing, not just `build`. Note that `catalog.json` is *not* in `.prettierignore`, so `format:check` covers it; the middleware runs Prettier on every write for exactly that reason (`JSON.stringify(…, null, 2)` alone is not Prettier-clean — it expands short arrays that Prettier keeps on one line).

`npm run test` is a deliberately narrow suite, not a safety net. It asserts the WhatsApp deep links in `src/data/contact.ts` and nothing else, because those links are the site's entire conversion path and they fail *silently*: a malformed number makes `wa.me` open an "invalid number" screen rather than throwing, so a typo still looks like a working button. The product-enquiry link is covered for the same reason plus one more — it carries the SKU, which is the only thing tying an enquiry to a specific listing, and an unencoded `&` in a collection title would truncate the message without any visible error. Nothing renders a component or asserts a layout.

So verification is still manual — see [`docs/architecture.md#verifying-a-change`](docs/architecture.md#verifying-a-change) for the full checklist.

## Hard rules

- **Animation is GSAP**, always inside `useGSAP(() => {...}, { scope: ref, dependencies: [...] })`. Never `useEffect` + raw gsap. Never add framer-motion or another animation library.
- **Amber (`amber-500`/`amber-400`) is the only accent colour**, over a `stone-50`/`stone-950` base. Don't introduce a second accent hue.
- **Use `DESIGN_TOKENS`** (`src/theme/designSystem.ts`) for layout, typography, and glass surfaces. Add a token instead of duplicating a class string a fourth time.
- **Every colour utility needs its `dark:` counterpart.** Dark mode is class-based via `ThemeProvider`; read it with `useTheme()`, never from `localStorage` or the DOM.
- **Named exports** for components, with JSDoc on the component and its props.
- **Images must be imported** in `src/data/assets.ts`, never referenced as `'src/data/images/...'` strings — string paths silently 404 in production builds. Catalog photography is the one exception, and only because nobody hand-writes those imports: it goes through the `import.meta.glob` registry in `src/data/catalogImages.ts`, which is the same build-time guarantee applied to a directory. Still never a string path.
- **Tailwind v4 is CSS-first.** There is no `tailwind.config.js`; theme changes go in the `@theme` block in `src/index.css`. Don't add global `h1`/`h2`/`p` rules there — typography belongs to `DESIGN_TOKENS`.
- **Don't create a second version of an existing component.** Wire up or fix the one that exists; if two are genuinely needed, ask which is canonical.
- **`CANDLE_CATEGORIES` is the source of truth.** Don't rename ids and don't change the hierarchy — ids are URL slugs and are referenced by promo slides *and* by every product in `catalog.json`. Every slide's `targetCollectionId` is checked on import by `assertTargetsResolve()` in `src/data/promotions.ts`, and every catalog key by `assertCatalogResolves()` in `src/data/catalog.ts`. Both throw in dev only; a new dataset needs its own such check or its ids go unchecked. An unknown slug redirects to `/collections`, so a broken CTA still *looks* like it worked — this is why the checks exist rather than another comment.
- **Cross-cutting groupings are not categories.** "Gifting" lives in `data/promotions.ts` and maps onto existing ids. Don't add it to `CANDLE_CATEGORIES`.
- **Products are content, added through `/update-list` — never by hand.** `src/data/catalog.json` and `src/data/catalog-images/` are written by the dev-server middleware in `scripts/catalogDevApi.ts` while `npm run dev` runs; publishing is then a normal commit. Keyed by real collection *and* variety ids, never positionally — `raw-materials` has four varieties, and reordering a collection must not silently repoint SKUs. **A SKU is minted once and never recomputed**, because it has already been quoted in WhatsApp enquiries. That is also why **a product's collection and variety cannot be edited** — the SKU encodes both, so a move would either renumber a live code or leave a SKU that lies about where the product sits; re-filing is delete-and-re-add. Name, price, fragrance notes and the photo *are* all editable. Prices are whole-rupee numbers rendered through `formatPrice`, so a cart can sum them later.
- **Catalog photography lives in `src/`, not `public/`.** `catalogImages.ts` resolves `src/data/catalog-images/**` through `import.meta.glob(…, { query: '?url' })`, which keeps Vite's content hashing and base-path rewriting for files nobody hand-imports. `public/catalog/x.jpg` was the obvious alternative and 404s *in production only*: `base` is `/` in dev but `/lumora_flames/` on the deploy, so a root-relative path resolves above the deploy root while looking perfect locally.
- **The CMS must never ship.** `/update-list` is gated on `import.meta.env.DEV` in `App.tsx`, so it is tree-shaken out of the bundle entirely, and the API plugin declares `apply: 'serve'` so `vite build` never sees it. The panel's `window.location.hostname` check is only a second layer for a misconfigured build — shipped code can be read and skipped, so don't mistake it for the guard.
- **No cards-and-grids for content.** Collections and varieties are told as full-bleed scroll moments, not repeated tiles. Each of the six collections gets its *own* treatment, not the same effect six times. Product *cards* are the one exception and are scoped to `/catalog` — a specific candle has a price and a code, and a shopper comparing three needs them adjacent. The rule protects the editorial layer; it does not forbid a listing.
- **`/catalog` renders one collection at a time.** It is an app surface rather than a page of the site: a fixed toolbar (context-aware back link, plus search on the right), a collapsible desktop rail, a six-card tab grid below `lg`, no footer, and products in a grid rather than `VarietyCatalog`'s rail. Over-scrolling past either end pages to the adjacent *stocked* collection — see `useTabOverscroll` for why that measures input intent instead of scroll position, and `CatalogPage`'s `LANDING_FRAMES` for why the landing position is held for a few frames rather than set once. Don't go back to rendering every collection at once; that is the cost the pagination exists to remove. Every offset below the fixed bar derives from the measured `--catalog-chrome` custom property, never a hardcoded rem — the bar's height differs by breakpoint and by how the tab titles wrap.
- **Every animated component needs a reduced-motion branch** — skip the pin, skip the autoplay, `clearProps` so nothing is stranded invisible. Animate transforms and opacity, never layout properties.
- **There is no backend, and `/contact` collects nothing.** The inquiry form, its OTP verification and the `VerificationProvider` seam were all deleted deliberately — a form needing a server, a database and a verified number was more infrastructure than the inquiry volume justifies. Enquiries arrive as WhatsApp or Instagram messages. Don't reintroduce a form, a fetch to an API, or a lead store without agreeing it first; the site is a static build and staying that way is the point.
- **`data/contact.ts` is the only source of handles, numbers and studio facts.** It appears in `Footer`, `AboutStory` and `ContactChannels`, and a number that is right in one and stale in another is worse than no number. Unfilled values use the `PLACEHOLDER` sentinel and are hidden from the page rather than rendered; `assertContactConfigured()` warns about them in dev only.
- **lucide-react v1 has no brand icons** (no Instagram/Facebook/YouTube/LinkedIn). Use a generic glyph with an `aria-label`, or add `simple-icons` deliberately.
- **`Draggable`/`InertiaPlugin` are free (GSAP 3.13+) but must be dynamically imported.** They're ~117 KB of source; a static import in `PromoCarouselTemplate3` took the landing chunk from 22 KB to 88 KB. Guard the async gap with a `cancelled` flag so a Draggable created after teardown still gets killed. Check the built chunk sizes after touching a GSAP plugin import.
- **The home page is full-bleed** — `/` and `/collections` opt out of `PageShell` and contain per section. Adding a section means keeping the alternating image-led / type-led rhythm; see [`docs/architecture.md`](docs/architecture.md#home-page-composition).

## Known gaps

- The four `STUDIO` facts in `src/data/contact.ts` (reply window, hours, city, bespoke lead time) are still the `PLACEHOLDER` sentinel, so the studio panel on `/contact` renders empty and is skipped. Filling them in is a copy task, not a code one.
- Enquiries are not recorded anywhere — they live in the studio's WhatsApp and Instagram inboxes. There is no log, no lead list, and no analytics on the conversion path. Accepted deliberately; see the hard rule above before proposing a fix.
- Source photos are 2–3 MB PNGs and dominate the bundle (~19 MB of assets against a 411 KB entry chunk). Converting to `.webp` is the single biggest available performance win; routes and below-fold images are already split and lazy.
- No SEO/meta handling. `index.html` still has the default `lumora_flames` title.
- Social links in `Footer` point at platform roots, not real brand profiles.
- Individual product pages don't exist yet. A `/catalog` group is the leaf of the flow and the deepest view of a specific candle.
- **The catalog is nearly empty.** Four products across nineteen varieties, so three of the six collection tabs list nothing and show a commission prompt instead of a grid — correct behaviour, not a bug. Filling them is a photography and copy task done through `/update-list`.
- **`/update-list` has no auth and no undo.** It doesn't need auth (it only exists on localhost, and its API only exists while `vite serve` runs), but a delete removes the photo from disk immediately. Git is the undo.
- **There is still no cart.** `resolveProductAction` in `src/lib/productActions.ts` is the seam for one: adding `'add_to_cart'` means a new `case` returning a `command` intent, which `ProductCard` already renders as a `<button>`. No change to `catalog.json` or to any component's markup.
