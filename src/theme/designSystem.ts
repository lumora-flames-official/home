/**
 * Master Design System Tokens for Lumora Flames
 * Establishes consistent luxury typography, spacing, and glassmorphism.
 */
export const DESIGN_TOKENS = {
  layout: {
    maxWidth: 'max-w-[1600px]',
    paddingX: 'px-6 sm:px-10 lg:px-16',
    headerOffset: 'pt-28 sm:pt-32',
    /**
     * Vertical rhythm between major editorial sections. Deliberately large —
     * whitespace is what separates a luxury layout from a catalogue page.
     */
    sectionGap: 'space-y-28 sm:space-y-36 lg:space-y-48',
    /**
     * Max width + gutters as one string, for sections inside a full-bleed page.
     * The home page's hero and typographic band run edge-to-edge, so the page
     * itself can't apply gutters — each contained section opts in with this.
     */
    contained: 'mx-auto w-full max-w-[1600px] px-6 sm:px-10 lg:px-16',
  },
  typography: {
    heroTitle: 'text-5xl sm:text-7xl lg:text-8xl font-extralight tracking-tight leading-[1.05]',
    sectionTitle: 'text-3xl sm:text-5xl font-light tracking-tight',
    /**
     * Oversized statement type for a full-bleed band where the words *are* the
     * visual — larger and looser than `heroTitle`, which shares its screen with
     * an eyebrow, body copy, and a CTA.
     */
    displayBand: 'text-4xl sm:text-6xl lg:text-7xl font-extralight tracking-tight leading-[1.12]',
    /** Editorial headline for a single collection or subcategory panel. */
    panelTitle: 'text-4xl sm:text-5xl lg:text-6xl font-light tracking-tight leading-[1.08]',
    body: 'text-sm sm:text-base font-light leading-relaxed',
    eyebrow: 'text-xs font-semibold tracking-[0.2em] uppercase text-amber-500',
    /** Uppercase label for buttons and pills. Never sentence-case. */
    button: 'text-xs font-semibold uppercase tracking-wider',
    buttonxxs: 'text-[0.625rem] font-semibold uppercase tracking-wider',
  },
  glass: {
    card: 'bg-white/70 dark:bg-stone-900/40 backdrop-blur-2xl border border-stone-200/80 dark:border-stone-800/80 shadow-2xl',
    floatingBtn:
      'bg-white/20 dark:bg-stone-950/30 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]',
    /** Lighter frosted surface for chips and inline pills over photography. */
    chip: 'bg-white/10 dark:bg-stone-900/40 backdrop-blur-md border border-white/20 dark:border-white/10',
  },
  overlay: {
    /** Bottom-up scrim. Required under any text sitting over photography. */
    scrimBottom: 'bg-gradient-to-t from-stone-950 via-stone-950/55 to-transparent',
    /** Left-to-right scrim for side-by-side editorial layouts. */
    scrimSide: 'bg-gradient-to-r from-stone-950/90 via-stone-950/40 to-transparent',
    /**
     * Amber light pool cast from low-centre — the hero's "this room is lit"
     * layer. A gradient rather than a blurred circle, so the falloff is smooth
     * at any viewport size.
     *
     * `circle` and not the shorthand `60% 50%` ellipse it used to be. An ellipse
     * that wide and flat has its transparent stop meet the container's bottom
     * edge along a near-horizontal line, and with the sides fading at a different
     * rate the whole thing reads as a soft-cornered *box* rather than light
     * radiating outward. A circle sized in `vmax` falls off at the same rate in
     * every direction, which is what light actually does.
     *
     * Centred on its own element (`50% 50%`) and sized `closest-side`, which is
     * the part that keeps it from reading as a rectangle. A background is clipped
     * to its element's box, so any origin *other* than the centre leaves the four
     * edges at four different distances from it — and wherever the nearest edge is
     * crossed while the gradient still carries alpha, that edge becomes a visible
     * straight line. Origin at the centre plus `closest-side` makes every edge
     * equidistant, and the stops below reach full transparency at 86% of that
     * radius, so the falloff finishes *inside* the box in every direction and
     * there is no edge left to see. It also means the element can be scaled
     * freely: box and gradient scale together, so the margin is preserved.
     *
     * The caller owes this one thing: a **square** element **centred on the
     * wick**, large enough to hold the falloff. `HeroChamber`'s pool wrapper is
     * where that happens, and why it is sized in `vmax` rather than `inset-0`.
     */
    scrimRadial:
      'bg-[radial-gradient(circle_closest-side_at_50%_50%,rgba(245,158,11,0.30),rgba(245,158,11,0.13)_28%,rgba(245,158,11,0.04)_53%,transparent_86%)]',
  },
} as const;
