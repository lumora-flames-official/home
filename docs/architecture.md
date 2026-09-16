# Architecture

## What this document is for

This describes **how to write code in this repository** — the rules, the reasoning behind them, and how the pieces connect. It deliberately does *not* inventory what lives in which file: that goes stale within a week and a file tree is something you can read faster than a paragraph about one.

What you will not find here: a directory listing, a per-component table, or a description of what any single file does. What you *will* find: the connections between things, where a new file belongs, and the standard every change is held to.

If you are about to write code, read [Coding rules](#coding-rules). If you are about to add a file, read [Where a new file goes](#where-a-new-file-goes). If you are trying to understand an existing behaviour, read [How to trace a connection](#how-to-trace-a-connection).

## Stack, and the constraints it imposes

React 19 (React Compiler) · Vite 8 · Tailwind CSS v4 · react-router-dom v7 · GSAP 3 + `@gsap/react` · lucide-react · TypeScript 6.

Each of these imposes something you have to work *with*, not around:

| Choice | The constraint it creates |
| --- | --- |
| React Compiler (via `babel-plugin-react-compiler`) | Manual `useMemo`/`useCallback` is usually redundant. Don't add memoisation without a measured reason. |
| Tailwind v4, CSS-first | There is **no `tailwind.config.js`**. Theme changes go in the `@theme` block in `src/index.css`. Don't add global `h1`/`p` rules there — typography is `DESIGN_TOKENS`' job. |
| Class-based dark mode | The variant is `@custom-variant dark (&:where(.dark, .dark *))`, so **every colour utility needs an explicit `dark:` counterpart**. Nothing inverts automatically. |
| GSAP | It is the *only* animation library. Never add framer-motion, react-spring, or CSS-keyframe animation for anything non-trivial. |
| lucide-react v1 | Ships **no brand icons** (no Instagram, Facebook, YouTube, LinkedIn). Use a generic glyph with an accessible label, or add `simple-icons` as a deliberate decision. |
| Vite static build | There is no server and no runtime data source. See [The publishing constraint](#the-publishing-constraint) — this is the biggest limitation in the project today. |
| No test framework | Verification is manual and non-negotiable: both themes, three widths. |

## Navigation tree

How a visitor moves through the site, and what each step hands to the next. Arrows leaving the box leave the site entirely.

```
/  ·  landing
│  seven full-bleed screens, alternating image-led and type-led
│
├── collection tile / index row ─────────→ /category/:categoryId
└── "explore the collections" ───────────→ /collections


/collections  ·  the story
│  one scroll-pinned viewport per collection, a different treatment each
│
└── "open this collection" ──────────────→ /category/:categoryId


/category/:categoryId  ·  the leaf
│  pinned walk through one collection's varieties,
│  driving the interactive candle canvas
│
│  then, once the pin releases, the catalog:
│  one horizontal product rail per variety, absent
│  for any variety with nothing listed yet
│
├── "back" ──────────────────────────────→ /collections
├── "commission this" ───────────────────→ /contact
│                                           hands over router state:
│                                           { categoryTitle }
└── product "commission" ────────────────⇥ wa.me, SKU + price pre-typed
                                            (leaves the site; bypasses /contact
                                             because the brief is already known)


/update-list  ·  catalog CMS  ·  DEV ONLY, NOT IN THE BUNDLE
│  writes src/data/catalog.json and src/data/catalog-images/
│  through /api/catalog on the dev server; publishing is a commit
│
└── (production has no such route — falls through to * → /)


/about  ·  brand story
│  scrubbed process timeline, pillars, enquiry panel
│
├── WhatsApp ────────────────────────────⇥ wa.me                (leaves site)
├── Instagram ───────────────────────────⇥ instagram.com        (leaves site)
└── "studio hours and every channel" ────→ /contact


/contact  ·  enquiry channels  ·  TERMINAL
│  reads { categoryTitle } to name the collection in the pre-typed message
│  no form, no backend, nothing persisted
│
├── WhatsApp ────────────────────────────⇥ wa.me, brief pre-typed
└── Instagram ───────────────────────────⇥ instagram.com
```

**Redirects**, kept so previously-published links never 404:

```
/catalog                       →  /collections
/category/:categoryId/details  →  /collections
unknown :categoryId            →  /collections     (never falls back to the first
                                                    collection — a silent wrong
                                                    answer is worse than a redirect)
*                              →  /
```

**Provider nesting**, which is fixed and load-bearing:

```
ErrorBoundary                 catches render errors below it
└── ThemeProvider             owns .dark on <html>, persists to localStorage
    └── Router
        ├── AmbientFlameGlow  page-level ambient light, outside the route
        ├── Navbar            rendered once, never per-route
        ├── PageTransition    resets scroll, plays the enter tween, then calls
        │   └── Suspense       ScrollTrigger.refresh() — pinned routes measure
        │       └── Routes     wrong without that refresh
        └── Footer            rendered once, below the route
```

Every route component is `React.lazy`-loaded. This is not a micro-optimisation: the content modules import the photography, so one eagerly-imported route pulls megabytes of PNG into the entry chunk.

**The leaf is `/category/:categoryId`.** Individual product pages don't exist. When they do, they slot in below it and `/contact` stays terminal.

## How content reaches the screen

One direction, no exceptions:

```
data/*.ts  ──→  types/*.ts validate the shape  ──→  features/*  compose  ──→  components/*  render
```

There is no backend, no API layer, and no fetching anywhere in the app. Every screen is a projection of a hardcoded module.

**Source-of-truth rules that are structural, not stylistic:**

- **The category dataset is canonical.** Ids are URL slugs *and* are referenced by promotional slides. Renaming one breaks live links and dead-ends a CTA at a redirect. Append; don't rename, don't restructure the hierarchy.
- **Cross-cutting groupings are not categories.** Things like *gifting* map **onto** existing category ids from the promotions module. Adding one to the category dataset makes it a navigable collection, which it isn't.
- **Every id reference is validated on import**, in development only, and throws. This exists because an unknown slug redirects rather than erroring — so a broken CTA still navigates and still *looks* like it worked. A new dataset must be registered with that assertion or its ids go unchecked.
- **Images are imported, never path strings.** Vite hashes asset filenames at build time; a `'src/data/images/x.png'` string resolves in dev and silently 404s in production. Register the import, reference the registry. Catalog photography is the sole exception to *how*, never to *whether*: nobody hand-writes an import for a file the CMS just created, so `catalogImages.ts` enumerates the directory with `import.meta.glob(…, { query: '?url' })` — same build-time hashing, same base-path rewriting, same build-verified existence. The tempting shortcut, `public/catalog/` plus a stored `/catalog/x.jpg`, is worse than a plain mistake: `base` is `/` locally and `/lumora_flames/` on the deploy, so it works perfectly in dev and 404s only once published.
- **Product data is machine-written, and that raises the bar on validation.** `catalog.json` is produced by the dev middleware, not reviewed in a hand-authored diff, so `assertCatalogResolves()` checks more than ids: it also catches a metadata entry whose image is missing from disk, and a duplicate SKU. Every one of those failures is invisible at runtime — an unknown key means the rail is simply absent, which is indistinguishable from a variety with nothing listed.
- **Contact handles, numbers and studio facts live in exactly one module.** They surface in the footer, the about page and the contact page — a number that is right in one and stale in another is worse than no number. Unfilled values use a `PLACEHOLDER` sentinel and are *hidden from the page* rather than rendered, with a dev-only console warning telling you they're missing. A customer must never see the word "TBC".

## The publishing constraint

**This is the most significant limitation in the project today, and the next thing we plan to fix.**

All copy, imagery and links are compiled into the bundle. Changing a single heading currently costs a full development cycle:

```
edit .tsx  →  npm run build  →  upload dist/ to the server  →  change is live
```

That means a typo fix needs a developer, a toolchain and a deploy. It should need none of those.

**Where the codebase already helps:** content is centralised in the data modules rather than scattered through JSX, so the eventual migration is *swap the data source*, not *rewrite the components*. Components read from typed modules; they don't care whether those modules were compiled in or fetched.

**Where the real difficulty sits, so it isn't discovered late:**

- **Images are the hard part, not text.** Text can move to fetched JSON almost mechanically. Images currently rely on Vite's build-time `import`, which is exactly what makes them hashed, cache-safe and 404-proof. Admin-uploaded images can't be build-time imports — they need real URLs from storage, which means a genuine hosting decision, not just a schema change.
- **Type safety is what's being traded.** Right now a malformed category is a TypeScript error before it can ship. Fetched content fails at runtime, in front of a visitor. Whatever replaces the modules needs runtime schema validation to get that guarantee back.
- **The id-integrity assertion has to survive.** It currently runs at import in dev and throws. Once content is remote, that check has to move to write-time in the admin panel — otherwise the one thing protecting live links stops protecting them.
- **Prefer build-time content over runtime fetching** if the option exists. A static build with content injected at build time keeps the site fast and keeps the 404-proof asset pipeline; only reach for runtime fetching if edits genuinely must appear without a rebuild.

**What the catalog CMS already settles, and what it doesn't.** The product catalog (`/update-list` → `scripts/catalogDevApi.ts` → `catalog.json`) is a working instance of the "prefer build-time content" bullet above, and it is worth reading before designing the general admin panel:

- **It moves the edit, not the deploy.** Adding a candle no longer touches a `.tsx` file, but publishing is still `commit → push → CI builds`. That is the trade that keeps every guarantee below intact.
- **It solves the image problem by sidestepping storage entirely.** Uploads land in `src/`, so they stay build-time imports — hashed, cache-safe, 404-proof — with no hosting decision. This does not scale to a non-technical editor on another machine, but it does mean "admin-uploaded images need real URLs from storage" is not yet forced.
- **It shows what runtime content will cost.** `catalog.json` is the one dataset TypeScript cannot fully vouch for; the cast in `catalog.ts` is honest about that, and `assertCatalogResolves()` is the runtime schema validation this document predicted would be needed. Note where it runs: at import, in dev, *before* a build can succeed. A remote content source has no such moment, which is why the same check would have to move to write-time.
- **The id-integrity requirement held.** The middleware validates against the real `CANDLE_CATEGORIES` via `ssrLoadModule` rather than a copied id list, so there is still one definition of what a valid collection is.

Until the broader work happens: **do not add a fetch, an API client, or a lead store to the shipped app.** The site is a static build and that is deliberate. `/api/catalog` is not a counter-example — it exists only under `vite serve`, and nothing in the production bundle can call it.

## Where a new file goes

Answer these in order; the first "yes" decides it.

1. **Is it a shared class string, ease, or duration?** → the design-tokens module or the animation module. Never a new constants file.
2. **Is it content — copy, a dataset, a handle, a URL?** → `data/`. Never inline in a component. This is what makes the [publishing constraint](#the-publishing-constraint) tractable later.
3. **Does it describe the shape of content?** → `types/`.
4. **Is it a pure function with no React in it?** → `lib/`.
5. **Is it stateful, reusable logic with hooks?** → `hooks/`.
6. **Is it app-wide state read by unrelated components?** → `context/`, exported through the barrel. Consume via its hook — never read the DOM or `localStorage` directly to infer provider state.
7. **Is it rendered by exactly one route, or does it own route state?** → `features/<route>/`.
8. **Is it presentational and used by two or more routes?** → `components/`, in the sub-folder matching its kind (layout chrome, UI element, canvas).

**The rule that overrides all eight: don't create a second version of something that exists.** Improve the one that's there. If two variants are genuinely needed, ask which is canonical before writing the second — a parallel component that drifts from its twin is the most expensive mistake available in this codebase, because both keep working and only one is right.

## How to trace a connection

There are no imports-by-magic here — no dependency injection container, no barrel re-exporting everything, no dynamic component registry. Tracing is mechanical:

- **"Where does this text/image/number come from?"** It is in a `data/` module. Grep the literal string; if it isn't there, it's hardcoded in JSX and probably shouldn't be.
- **"What uses this?"** Grep the exported symbol name. Named exports are mandatory partly for this reason: default exports get renamed at the import site and become ungreppable.
- **"What renders at this URL?"** The router is one file with an explicit route table. Start there and follow the lazy import.
- **"Why does this animation exist / why is it written this way?"** Read the JSDoc above it. If a non-obvious technique has no explanation, that's a bug in the documentation — fix it while you're there.
- **"What breaks if I rename this id?"** Every slide's target id, every URL containing it, and the import-time assertion. Don't.

## Coding rules

### JSDoc explains *why*, not *what*

Every component, prop, exported function, and non-obvious block gets a doc comment. The bar is not "describe the code" — the code already does that. The bar is: **a reader who disagrees with this decision should find their objection already answered.**

```ts
// Useless — restates the signature.
/** Builds the WhatsApp link. */

// Useful — explains a decision, and pre-empts the "fix" that would break it.
/**
 * Builds the WhatsApp deep link with the greeting pre-typed.
 *
 * `wa.me` resolves to the app on mobile and WhatsApp Web on desktop, so one
 * href covers both — no user-agent sniffing.
 *
 * The number must be digits only, country code first. `wa.me` does not reject a
 * malformed number with an error; it opens an "invalid number" screen, so a typo
 * here looks like a working button.
 */
```

Specifically, document:

- **Why this approach and not the obvious one.** If the obvious approach was tried and failed, say so, and say how it failed.
- **Costs paid on purpose.** A 117 KB dependency, a duplicated value, a magic number — if a reader would call it a mistake, explain why it isn't.
- **What a caller owes you.** Preconditions that types can't express: "must be a square element centred on the wick", "digits only, no `+`".
- **Load-bearing ordering.** If B must happen after A, say what breaks otherwise.
- **Empirical numbers.** "took the landing chunk from 22 KB to 88 KB" is worth more than "is large".

Comments that just narrate the next line are noise. Delete them.

### Don't repeat yourself — and know where the line is

- A class string appearing a **third** time becomes a design token. A fourth time is a bug.
- A value that must agree in two places gets **one** definition and is imported. Two constants that must match will eventually not match.
- Repeated conditional class logic goes through the `cn()` helper, not string concatenation.
- Ease strings and durations come from the shared motion vocabulary. Hand-writing `ease: 'power3.out'` again means you didn't look.

**Where DRY stops:** don't abstract two things that merely *look* alike. Each collection deliberately gets its own scroll treatment — collapsing six bespoke sections into one configurable component would be DRY and would also destroy the thing that makes the site not a catalogue. Duplication of *appearance* is fine; duplication of *truth* is not.

### Exports and naming

- **Named exports** for everything except the root app component.
- Components are `PascalCase`, hooks are `useThing`, constants are `SCREAMING_SNAKE`, pure helpers are `camelCase` verbs.
- Name after the role, not the shape: a component named for what it *is* survives a redesign; one named for how it currently *looks* doesn't.

### Motion

- All GSAP goes inside `useGSAP(() => {…}, { scope: ref, dependencies: […] })`. Never `useEffect` + raw gsap — you lose GSAP's cleanup and strand tweens on unmount.
- Register plugins at module top level in files that pin or scrub.
- **Every animated component needs a reduced-motion branch**: skip the pin, skip the autoplay, and clear props so nothing is stranded mid-tween or invisible.
- **Animate transforms and opacity only.** Scrub `yPercent`/`scaleY` on an oversized element rather than `top`/`height` — layout properties force reflow on every frame.
- Plugins heavy enough to matter are **dynamically imported**, and the async gap is guarded with a cancelled flag so an instance created after teardown still gets killed.

### Visual and theming

- **Amber is the only accent**, over a stone base. A second accent hue is a redesign, not a tweak.
- Use the design tokens for layout, typography and glass surfaces.
- **Every colour utility needs its `dark:` counterpart** — except on a fixed brand surface (an amber fill reads the same in both themes), and when you make that exception, comment it so the next reader doesn't "fix" it.
- **No cards-and-grids for content.** Collections and varieties are full-bleed scroll moments, not repeated tiles.
- The home page and the collections story are full-bleed and opt out of the page shell; they contain per section instead. A page-level wrapper would cage a `100svh` hero.
- Home *teases*, `/collections` *delivers*. Home features a named subset and indexes the rest; it must not become a second copy of the collections story.
- Consecutive home screens must not resolve the same way — image-led and type-led alternate, and the type-led screens are what let the page grow without getting heavier.

### Accessibility

- Anything that leaves the site is a real `<a href>`, not a button with a handler — middle-click, long-press and "copy link address" have to work, and only an anchor gives that for free. Internal navigation is a button or a router link.
- Decorative icons are `aria-hidden`; an icon that *is* the label needs an accessible name.
- Sections that have a heading get `aria-labelledby` pointing at it.
- Visible focus states are required, including the ring offset colour for **both** themes — getting it wrong on one is invisible until somebody tabs to it.
- Use semantic elements where the content is semantic: a term-and-value list is a `<dl>`.

### Verifying a change

Automated coverage stops at one file. `src/data/contact.test.ts` asserts the WhatsApp deep link and nothing else, because that link is the entire conversion path and it fails *silently* — a malformed number makes `wa.me` open an "invalid number" screen rather than throwing, so a typo still looks like a working button. Nothing renders a component or asserts a layout, so for everything else this list is the whole safety net:

1. `npm run dev`, then exercise **every route the change can reach** — including the redirects.
2. Both **light and dark** mode.
3. **Phone, tablet, desktop** widths.
4. With **reduced motion** enabled at the OS level.
5. `npm run lint`, `npm run format:check`, `npm run test` and `npm run build` must all pass — both deploy workflows gate on all four, so one red check blocks the deploy entirely.
6. If you touched a GSAP plugin import, **check the built chunk sizes** — a static import of a heavy plugin can quietly quadruple the landing chunk.
7. If you touched the **catalog or the CMS**: add a product through `/update-list` and confirm the rail appears on that collection page. Then exercise the edit path, which has more corners than it looks: change only the name (the photo file must *not* be renamed), replace the photo without renaming (the filename must be reused, not suffixed `-2`), and delete the image from disk and supply a new one through the form — that last one is the recovery path for a catalog the dev-time assertion is refusing to load, and `/update-list` stays usable precisely because it reads the API rather than importing `data/catalog.ts`. Finally delete the product and check `git status`, since these operations add and remove real files. Then `npm run build && npm run preview` and confirm `/update-list` falls through to the home redirect and `grep -rl "update-list" dist/` finds nothing. A shipped panel is the failure that matters here.
8. **Resize the window; don't only load at one size.** A pinned section re-measures on resize, and if its length and its height are derived from different sources they can disagree — Safari reports a stale `window.innerHeight` for a beat after layout has reflowed, which left the hero short with a blank band under it while Chrome looked perfect. Derive both from the same box; see the `end` callback in `HeroChamber`.

Node v12 is the machine default and breaks every script with a bare `Unexpected token ?`. Use Node 24.
