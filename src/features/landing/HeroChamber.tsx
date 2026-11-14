import React, { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { ChevronDown, Flame } from 'lucide-react';
import { CANDLE_CATEGORIES } from '../../data/categories';
import { InteractiveCandleCanvas } from '../../components/canvas/InteractiveCandleCanvas';
import { CandleSmoke, SMOKE_PUFF_COUNT } from '../../components/canvas/CandleSmoke';
import { EmberField } from '../../components/ui/EmberField';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { cn } from '../../lib/utils';
import { DESIGN_TOKENS } from '../../theme/designSystem';
import { EASE, DURATION, settleInstantly } from '../../lib/animations';

gsap.registerPlugin(ScrollTrigger);

/**
 * Visual identity for the hero's candle: the urli from Traditional & Festive.
 *
 * Looked up from `CANDLE_CATEGORIES` rather than hardcoded, so retoning that
 * collection's wax updates the hero too. Falls through to `undefined` if the
 * lookup misses, and `InteractiveCandleCanvas` renders its neutral jar — the
 * hero must never blank out over a content edit.
 */
const HERO_VISUAL = CANDLE_CATEGORIES.find(
  (c) => c.id === 'traditional-festive'
)?.subCategories.find((s) => s.id === 'urli-diya')?.visual;

/**
 * Scroll distance, as a multiple of the hero's own height, spent lighting the
 * candle before the page moves on. Roughly one flick of a trackpad — long enough
 * for the ignition to read as a deliberate beat, short enough that nobody feels
 * held hostage by a pinned screen.
 *
 * The section is `min-h-[100svh]`, so this is a multiple of the viewport height
 * too — but it is measured off the element, never off `window.innerHeight`. See
 * the `end` callback in the ignition block for why that distinction matters.
 */
const IGNITION_SCROLL_SECTIONS = 1.1;

/** Props for {@link HeroChamber}. */
export interface HeroChamberProps {
  /** Scrolls the page to the section below the hero, from the scroll cue. */
  onScrollCue?: () => void;
}

/**
 * HeroChamber is the home page's opening screen: centred display type standing
 * in a dark chamber lit by a single candle.
 *
 * ## Why it is built this way
 *
 * The hero was previously type on a flat background, which for a brand whose
 * entire metaphor is light meant the first screen was unlit. Rather than add a
 * 3D library or another multi-megabyte photograph — imagery is already the
 * app's dominant payload — this composes four cheap layers:
 *
 * 1. a radial amber light pool that breathes, the *cast light*;
 * 2. {@link EmberField}, sparks rising as though a flame burns off-frame;
 * 3. {@link InteractiveCandleCanvas}, the existing procedural candle, scaled up
 *    and cropped by the bottom edge so it reads as being in the room with you;
 * 4. the headline, genuinely centred in a column.
 *
 * Total added image weight: zero.
 *
 * ## Motion
 *
 * Everything animates transform and opacity only. On scroll the type drifts up
 * and the light pool dims, so leaving the hero reads as the candle being carried
 * out of the room. On desktop, pointer movement parallaxes the candle and pool
 * against each other for shallow depth.
 *
 * With reduced motion preferred: no embers, no breathing, no parallax, no scroll
 * fade. The candle still renders lit and the pool still glows, so the screen is
 * a lit chamber even when perfectly still.
 */
export const HeroChamber: React.FC<HeroChamberProps> = ({ onScrollCue }) => {
  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const candleRef = useRef<HTMLDivElement>(null);
  const poolRef = useRef<HTMLDivElement>(null);
  const smokeRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  // Entrance. Deliberately says nothing about the flame: the candle arrives
  // unlit, and lighting it belongs to scroll.
  useGSAP(
    () => {
      if (prefersReducedMotion) {
        settleInstantly(['.hero-eyebrow', '.hero-line', '.hero-subtitle', '.hero-cue']);
        return;
      }

      const tl = gsap.timeline({ defaults: { ease: EASE.enter } });

      // The dark chamber and the unlit candle settle first, then the type
      // arrives into it — the order is the point.
      tl.fromTo(candleRef.current, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1.4 }, 0.15)
        .fromTo(
          '.hero-eyebrow',
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: DURATION.fast },
          0.5
        )
        // Per-line stagger rather than one block fade: the headline assembles
        // itself, which is the single most "premium" beat on the page.
        .fromTo(
          '.hero-line',
          { y: 46, opacity: 0 },
          { y: 0, opacity: 1, duration: DURATION.slow, stagger: 0.12 },
          0.65
        )
        .fromTo(
          '.hero-subtitle',
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: DURATION.base },
          '-=0.45'
        )
        .fromTo('.hero-cue', { opacity: 0 }, { opacity: 1, duration: DURATION.base }, '-=0.2');
    },
    { scope: rootRef, dependencies: [prefersReducedMotion] }
  );

  /*
   * Ignition. The hero pins for `IGNITION_SCROLL_SECTIONS` and that scroll distance
   * lights the candle: flame grows from nothing to full, the cast light pool
   * grows with it, embers fade in. Scrolling back shrinks it, and reaching the
   * top blows it out with smoke.
   *
   * Why a separate `useGSAP` from the entrance: this one pins, so it must not be
   * torn down and re-measured whenever the entrance's dependencies change, and
   * two timelines on the same elements would fight over `--flame-intensity`.
   *
   * Everything scrubs one variable — `--flame-intensity` on the stage — rather
   * than tweening the flame, its bloom, and the pool separately. One writer, so
   * flame size and cast light can never disagree, which is the whole ask: the
   * glow reacts *because* it is the same number.
   */
  useGSAP(
    () => {
      const stage = stageRef.current;
      if (!stage) return;

      // Reduced motion: a lit chamber, immediately, with no pin and no scrub.
      // The pin is the part that would be actively unpleasant — it spends a
      // viewport of someone's scrolling on decoration.
      if (prefersReducedMotion) {
        gsap.set(stage, { '--flame-intensity': 1 });
        gsap.set(poolRef.current, { opacity: 1, scale: 1 });
        gsap.set('.hero-embers', { opacity: 1 });
        // No blow-out beat at all, so the wisps stay at `opacity: 0` and need no
        // placing — a candle that never goes out never smokes.
        return;
      }

      /**
       * Puts the smoke layer's origin on the wick tip.
       *
       * The smoke can't live inside the candle any more (it would paint behind
       * the headline — see {@link CandleSmoke}), so it no longer inherits the
       * candle's position for free. The flame's own box is measured instead of
       * hardcoding an offset, because the candle wrapper is scaled 1.15/1.45/1.7
       * across breakpoints and translated 26% down: any fixed percentage would
       * only line up at one width.
       *
       * Called immediately before each blow-out rather than once on mount. Mount
       * is too early: the entrance tween still has the candle at `y: 40`, so the
       * wisps were pinned ~31px below the wick and rose out of the flame's base.
       * Measuring at the moment the smoke is needed is both correct and immune to
       * whatever else has moved the candle since.
       *
       * Coordinates are relative to the section, which is `position: fixed` while
       * pinned — so both rects come from `getBoundingClientRect()` and the
       * difference is valid in either state.
       */
      const placeSmoke = () => {
        const root = rootRef.current;
        const smokeLayer = smokeRef.current;
        const flame = root?.querySelector('.hero-flame-box');
        if (!root || !smokeLayer || !flame) return;

        const rootBox = root.getBoundingClientRect();
        const flameBox = flame.getBoundingClientRect();
        // Bottom-centre of the flame box is the wick tip: the flame overlaps the
        // wick by `-mb-1.5`, so its base is exactly where the wisps start.
        gsap.set(smokeLayer, {
          left: flameBox.left + flameBox.width / 2 - rootBox.left,
          top: flameBox.bottom - rootBox.top,
        });
      };

      /**
       * Smoke, on blow-out. A fixed timeline rather than more scrub, because
       * that is what makes it read as *extinguishing* — scrubbed smoke would
       * un-rise the instant you nudged back down, and smoke doesn't do that.
       *
       * It animates only the wisps. The flame, pool, and embers are already on
       * their way to zero under the scrub, and a second writer on
       * `--flame-intensity` would just fight it.
       */
      const smoke = () => {
        placeSmoke();
        const tl = gsap.timeline();

        /*
         * The stem: one thin thread that leaves the wick fast and holds its line.
         * It is short-lived on purpose — it exists to sell the *instant* of the
         * blow-out, and a thread that survives the whole plume is the cylinder
         * problem all over again. It stretches as it goes (`scaleY` to 1.8) the
         * way a column of hot gas thins while it accelerates.
         */
        tl.fromTo(
          '.flame-smoke-stem',
          { opacity: 0, y: 0, x: 0, scaleY: 0.35, scaleX: 1, rotate: 0 },
          { opacity: 0.7, duration: 0.12, ease: 'power2.out' },
          0
        )
          .to(
            '.flame-smoke-stem',
            { y: -30, scaleY: 1.6, scaleX: 0.7, duration: 0.9, ease: 'power1.out' },
            0.02
          )
          // Gone before the plume is even half-emitted. The thread is the *instant*
          // of the blow-out; a thread that outlives the plume is the cylinder
          // problem again, and by then the puffs already cover the wick.
          .to('.flame-smoke-stem', { opacity: 0, duration: 0.45, ease: 'power2.in' }, 0.3);

        /*
         * The plume, one tween-set per puff rather than one staggered tween: a
         * stagger shares its values across the batch, so every puff would travel
         * the same distance over the same time and the plume would move as a rigid
         * body. Per-puff tweens are what let each one have its own life.
         *
         * Emission spacing has to stay well under a puff's life or the column
         * empties out behind the plume, and it *widens* as the batch goes on
         * (`EMIT_GROWTH`). Even spacing put the whole batch out inside a second,
         * so a beat later every puff had left the base and the smoke floated
         * detached from the wick with a visible hole under it. Widening spacing
         * keeps the base replenished while the wick is still hot and thins out as
         * it cools, which is also just what a dying wick does. The small random
         * jitter stops the spacing itself becoming an audible rhythm.
         */
        const EMIT = 0.04;
        const EMIT_GROWTH = 0.07;

        gsap.utils.toArray<HTMLElement>('.flame-smoke-puff').forEach((puff, index) => {
          const delay =
            0.03 + EMIT * index * (1 + EMIT_GROWTH * index) + gsap.utils.random(0, 0.04);

          /*
           * `age` runs 1 → 0 down the emission order, so it describes where a puff
           * sits in the plume: the first one out is its head, the last is still at
           * the wick. Rise, swell and drift all key off it, which is what gives
           * the column its gradient — tight and dark at the base, stretched, broad
           * and faint at the top. Drawing those per-puff at random instead left
           * holes wherever two neighbours happened to pick far-apart values.
           */
          const age = 1 - index / (SMOKE_PUFF_COUNT - 1);
          const rise = -(55 + age * 175) * gsap.utils.random(0.88, 1.12);
          const life = gsap.utils.random(1.9, 2.6) + age * 0.5;

          // Two-stage drift is what makes it curl rather than fan: a lean while
          // the puff is still in the thermal, then a harder commit in a direction
          // drawn independently once it has lost the column. One x tween can only
          // ever draw a straight diagonal.
          const lean = gsap.utils.random(-9, 9);
          const drift = lean + gsap.utils.random(-30, 30) * (0.4 + age);

          tl.fromTo(
            puff,
            // Starting scale is 0.8, not near-zero: a puff that begins at 0.3 is a
            // 4px speck, and twenty specks at the base of the column read as dust,
            // not smoke. It still swells, just from something already legible.
            { opacity: 0, x: gsap.utils.random(-2, 2), y: 0, scale: 0.8, rotate: 0 },
            { opacity: gsap.utils.random(0.55, 0.9), duration: 0.22, ease: 'power1.out' },
            delay
          )
            // The rise. `power1.out` because smoke leaves a hot wick quickly and
            // slows as it cools. The swell is the puff losing definition, and it
            // scales with `age` too, so the column widens as it climbs — narrow at
            // the wick, broad and diffuse at the top.
            .to(
              puff,
              {
                y: rise,
                scale: (1.4 + age * 2.6) * gsap.utils.random(0.85, 1.15),
                rotate: gsap.utils.random(-70, 70),
                duration: life,
                ease: 'power1.out',
              },
              delay + 0.03
            )
            .to(puff, { x: lean, duration: life * 0.35, ease: 'sine.inOut' }, delay + 0.03)
            .to(puff, { x: drift, duration: life * 0.65, ease: 'sine.inOut' }, delay + life * 0.39)
            // The fade gets its own ease. Bundled into the rise it inherited
            // `power1.out` and was almost gone in the first few frames, while the
            // puff was still visibly moving — smoke that vanishes before it has
            // risen. `power2.in` holds it low and thins it out at the top.
            .to(puff, { opacity: 0, duration: life * 0.85, ease: 'power2.in' }, delay + life * 0.3);
        });

        return tl;
      };

      /** Wick catches again: clear any wisps still in the air. */
      const clearSmoke = () => {
        gsap.killTweensOf('.flame-smoke');
        gsap.set('.flame-smoke', { opacity: 0, clearProps: 'transform' });
      };

      /*
       * `lit` latches the blow-out so it fires once per trip to the top.
       *
       * This is driven from `onUpdate` rather than `onLeaveBack` because the hero
       * sits at the very top of the document: `start: 'top top'` resolves to
       * scroll position 0, so there is no scroll range *before* the trigger and
       * `onLeaveBack` never fires. Reaching progress 0 travelling up is the only
       * signal available.
       */
      let lit = false;

      const ignition = gsap.timeline({
        scrollTrigger: {
          trigger: rootRef.current,
          start: 'top top',
          /*
           * Measured off the section, not `window.innerHeight`.
           *
           * The section's height comes from CSS (`min-h-[100svh]`) and the pin
           * distance comes from JS, so if the two read different sources they can
           * disagree — and on a resize in Safari they do. Safari keeps reporting
           * the pre-resize `window.innerHeight` for a beat after layout has
           * already reflowed, so a refresh triggered by the resize measured a
           * 1028px-tall section while `innerHeight` still claimed 1327: 1460px of
           * pinned scroll reserved for a screen 329px shorter than that. The
           * spare padding on ScrollTrigger's pin-spacer has nothing in it, so the
           * hero appeared to shrink with a blank band under it until the next
           * reload. Chrome refreshes both together and never showed it.
           *
           * `offsetHeight` is the same layout the `100svh` produced, so the two
           * numbers now come from one source and cannot drift apart — the same
           * one-writer rule the flame's `--flame-intensity` follows above.
           * ScrollTrigger reverts pins before it calls `end`, so this reads the
           * natural height rather than a height it set on a previous pass.
           */
          end: () => `+=${(rootRef.current?.offsetHeight ?? 0) * IGNITION_SCROLL_SECTIONS}`,
          scrub: 0.6,
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            if (lit && self.progress <= 0.001) {
              lit = false;
              smoke();
            } else if (!lit && self.progress > 0.02) {
              lit = true;
              clearSmoke();
            }
          },
        },
      });

      ignition
        // The catch: a quick jump to a small flame, because a wick doesn't ramp
        // linearly from nothing — it takes, then settles into a burn.
        .fromTo(
          stage,
          { '--flame-intensity': 0 },
          { '--flame-intensity': 0.32, duration: 0.22, ease: 'power2.out' }
        )
        // Then the steady climb to full, which is most of the scroll distance.
        .to(stage, { '--flame-intensity': 1, duration: 0.78, ease: 'sine.inOut' })
        // Cast light tracks the flame. Opacity and scale, not a colour shift, so
        // an unlit chamber is genuinely dark rather than tinted amber.
        //
        // No `transformOrigin` needed: the pool is a square box centred on the
        // wick and the gradient is centred in that box, so the default origin
        // already *is* the flame. It previously had to be overridden to
        // `50% 78%`, because the box was the viewport and the gradient sat
        // off-centre inside it — scaling about the box centre grew the pool from a
        // point above the candle.
        .fromTo(
          poolRef.current,
          { opacity: 0, scale: 0.55 },
          { opacity: 1, scale: 1, duration: 1, ease: 'sine.out' },
          0
        )
        // Sparks only exist once there's a fire to throw them.
        .fromTo(
          '.hero-embers',
          { opacity: 0 },
          { opacity: 1, duration: 0.6, ease: EASE.scrub },
          0.3
        )
        // The type clears on the same timeline rather than from a second
        // ScrollTrigger. A trigger anchored to this section would be anchored to
        // a *pinned* element and mismeasure; sharing the timeline also means the
        // type returns on the way back up for free.
        .to('.hero-fade', { yPercent: -22, opacity: 0, ease: EASE.scrub, duration: 0.4 }, 0.6);

      // The pool breathes, as a real flame's cast light does. On its own nested
      // element, not on `poolRef` — the scrub already owns that node's opacity
      // and scale, and two writers on one property is a flicker bug. Nested
      // opacity multiplies, so this is invisible while the candle is unlit and
      // needs no gating.
      gsap.to('.hero-pool-breath', {
        opacity: 0.8,
        scale: 1.06,
        duration: 6,
        repeat: -1,
        yoyo: true,
        ease: EASE.ambient,
      });
    },
    { scope: rootRef, dependencies: [prefersReducedMotion] }
  );

  // Pointer parallax. Separate from the entrance so the two never fight over the
  // same tween, and pointer-driven so it costs nothing until the mouse moves.
  useGSAP(
    () => {
      if (prefersReducedMotion) return;
      // `(pointer: fine)` rather than a width query: the target is "has a mouse",
      // and a touch device that happens to be wide still shouldn't run this.
      if (!window.matchMedia('(pointer: fine)').matches) return;

      const root = rootRef.current;
      if (!root) return;

      // `quickTo` reuses one tween per property instead of allocating a new one
      // per pointer event — the difference is visible on a 120Hz trackpad.
      const candleX = gsap.quickTo(candleRef.current, 'x', { duration: 0.9, ease: 'power2.out' });
      const candleY = gsap.quickTo(candleRef.current, 'y', { duration: 0.9, ease: 'power2.out' });
      const poolX = gsap.quickTo(poolRef.current, 'x', { duration: 1.3, ease: 'power2.out' });

      const onPointerMove = (event: PointerEvent) => {
        const { width, height } = root.getBoundingClientRect();
        // Normalised to −1…1 around centre.
        const nx = (event.clientX / width) * 2 - 1;
        const ny = (event.clientY / height) * 2 - 1;

        candleX(nx * 8);
        candleY(ny * 6);
        // The pool trails further than the candle, which is what creates depth.
        poolX(nx * 18);
      };

      root.addEventListener('pointermove', onPointerMove);
      return () => root.removeEventListener('pointermove', onPointerMove);
    },
    { scope: rootRef, dependencies: [prefersReducedMotion] }
  );

  return (
    <section
      ref={rootRef}
      aria-label="Lumora Flames"
      className="relative flex min-h-[100svh] w-full flex-col items-center justify-center overflow-hidden"
    >
      {/* The lighting stage. Owns `--flame-intensity` — every lit layer below
          inherits it, so one scrubbed value drives flame, bloom, and cast light
          together. Starts at 0: the page lands on an unlit candle.

          The initial value is an arbitrary-property *class*, not an inline
          `style`. Tailwind emits it into the stylesheet, so GSAP's inline write
          overrides it and a re-render of this component can't reset the flame
          mid-scroll — which an inline `style={{ '--flame-intensity': 0 }}` would
          do on every render. */}
      <div
        ref={stageRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [--flame-intensity:0]"
      >
        {/* Layer 1 — the chamber. Deepens the base so the amber reads as light
            rather than as a coloured panel, in both themes. */}
        <div className="absolute inset-0 bg-gradient-to-b from-stone-100 via-stone-50 to-amber-50/40 dark:from-stone-950 dark:via-stone-950 dark:to-stone-900" />

        {/* Layer 2 — cast light. The outer node's opacity and scale are scrubbed
            to match the flame's size; the inner one breathes on a loop. Split in
            two so the two animations never write the same property.

            A square box centred on the wick, not `inset-0`.

            `inset-0` made this the viewport's shape, and a background is clipped
            to its element's box — so with the gradient's origin down at the wick,
            the bottom edge sat ~14vmax away while the far corner needed ~60vmax.
            The gradient was still carrying visible alpha when the box ran out, and
            that cut edge is the rectangle. Scrubbing made it worse rather than
            better: `scale(0.55)` shrinks the clip box to 792×495 *inside* a
            1440×900 screen, putting all four cut edges in plain view mid-ignition.

            Square and wick-centred instead, so every edge is equidistant from the
            origin and the falloff completes inside the box on all sides — there is
            no edge left to reveal, at any scale. `-mx-` / `-my-` negative margins
            do the centring rather than `-translate-x-1/2`: GSAP owns `transform`
            on this node (scrub) and would silently drop a Tailwind translate.

            Sized `200vmax` so the shortest half-width (100vmax) still exceeds the
            farthest corner from the wick, measured at 66–85vmax across 390px to
            1920px. `top-[76%]` is the wick, which sits at 68–76% of viewport
            height depending on where the candle's responsive scale lands. */}
        <div
          ref={poolRef}
          className="absolute left-1/2 top-[76%] -mx-[100vmax] -my-[100vmax] h-[200vmax] w-[200vmax] opacity-0"
        >
          <div
            className={cn('hero-pool-breath absolute inset-0', DESIGN_TOKENS.overlay.scrimRadial)}
          />
        </div>

        {/* Layer 3 — embers. Renders nothing under reduced motion. Faded in with
            the flame, since an unlit wick throws no sparks. */}
        <EmberField count={14} className="hero-embers bottom-0 top-auto h-2/3 opacity-0" />

        {/* Layer 4 — the candle. Cropped by the section's bottom edge so it feels
            present in the room instead of pasted on. `scale` on a wrapper rather
            than new geometry, so the existing canvas is reused untouched. */}
        <div
          ref={candleRef}
          className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[26%] scale-[1.15] opacity-90 sm:scale-[1.45] lg:scale-[1.7]"
        >
          <InteractiveCandleCanvas
            flameIntensity={0}
            inheritFlameIntensity
            visual={HERO_VISUAL}
            label="Lumora"
            flameClassName="hero-flame-box"
          />
        </div>
      </div>

      {/* Blow-out smoke. Outside the stage on purpose, and the reason is worth
          keeping: the stage and the candle wrapper are both transformed, and a
          transform creates a stacking context, which seals every descendant into
          that node's paint slot regardless of its own `z-index`. Nested at the
          wick — where it used to be — the smoke could not rise in front of the
          headline no matter what `z-index` it carried.

          Lifting the whole candle above the type instead was measurably wrong: at
          1024×768 the vessel body overlaps the headline, so the wax would occlude
          glyphs. Only the smoke moves.

          `z-20` clears the type's `z-10`; positioned at the wick by `placeSmoke`,
          since out here it no longer inherits the candle's geometry. */}
      <div
        ref={smokeRef}
        className="pointer-events-none absolute left-1/2 top-0 z-20 h-0 w-0 scale-[1.15] sm:scale-[1.45] lg:scale-[1.7]"
      >
        <CandleSmoke />
      </div>

      {/* Type. Sits above the candle's flame, which is why the column is capped
          and pushed up off the vertical centre. */}
      <div
        className={cn(
          'hero-fade relative z-10 flex flex-col items-center text-center',
          DESIGN_TOKENS.layout.contained,
          'max-w-4xl gap-7 pb-[max(10rem,32svh)] pt-28 sm:gap-9 sm:pb-[max(12rem,36svh)] sm:pt-32'
        )}
      >
        <span className="hero-eyebrow inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 backdrop-blur-md dark:text-amber-300">
          <Flame className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
          Handcrafted Artisanal Luxury
        </span>

        <h1 className={cn(DESIGN_TOKENS.typography.heroTitle, 'text-stone-900 dark:text-stone-50')}>
          {/* Each line is its own block so the stagger reads as type rising out
              of the page rather than fading in place. */}
          <span className="hero-line block">Crafted to</span>
          <span className="hero-line block font-light italic text-amber-500">illuminate</span>
          <span className="hero-line block">your world.</span>
        </h1>

        <p className="hero-subtitle max-w-2xl text-base font-light leading-relaxed text-stone-600 dark:text-stone-300 sm:text-lg">
          Custom fragrance blends, frosted glass jars, playful wax sculpture, and festive urlis —
          natural soy wax, poured by hand for quiet luxury.
        </p>
      </div>

      {/* Scroll cue. A real button when a handler is supplied, so it works from
          the keyboard rather than being decoration that only looks clickable. */}
      {onScrollCue ? (
        <button
          type="button"
          onClick={onScrollCue}
          className={cn(
            'hero-cue absolute bottom-6 left-1/2 z-10 -translate-x-1/2 inline-flex h-11 items-center gap-2 rounded-full px-4',
            'text-stone-500 transition-colors hover:text-amber-600 dark:text-stone-400 dark:hover:text-amber-400',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500',
            DESIGN_TOKENS.typography.button
          )}
        >
          Scroll to explore
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            'hero-cue absolute bottom-8 left-1/2 z-10 -translate-x-1/2 inline-flex items-center gap-2 text-stone-500 dark:text-stone-400',
            DESIGN_TOKENS.typography.button
          )}
        >
          Scroll to explore
          <ChevronDown className="h-4 w-4" />
        </span>
      )}
    </section>
  );
};
