import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import type { CandleVessel, CandleVisual } from '../../types/category';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { cn } from '../../lib/utils';
import { CandleFlame } from './CandleFlame';

/**
 * Geometry per vessel silhouette. Colour is never set here — it comes from the
 * subcategory's `CandleVisual`, so a new wax tone never requires touching this
 * table, and a new silhouette never requires touching the data.
 */
const VESSEL_GEOMETRY: Record<
  CandleVessel,
  {
    /** Body dimensions and corner treatment. */
    body: string;
    /** Whether to draw a glass rim (containers) or leave the wax exposed. */
    hasRim: boolean;
    /** Width of the cast-shadow ellipse beneath the candle. */
    shadow: string;
  }
> = {
  jar: { body: 'w-36 h-56 rounded-b-2xl rounded-t-lg', hasRim: true, shadow: 'w-40' },
  pillar: { body: 'w-24 h-64 rounded-md', hasRim: false, shadow: 'w-28' },
  // Wide and shallow, like a brass urli floating on water.
  urli: { body: 'w-52 h-24 rounded-b-[50%] rounded-t-lg', hasRim: true, shadow: 'w-52' },
  // Asymmetric radii read as hand-shaped rather than machine-poured.
  sculpture: {
    body: 'w-40 h-44 rounded-[42%_58%_45%_55%/55%_42%_58%_45%]',
    hasRim: false,
    shadow: 'w-40',
  },
  // A supply vessel: squat, wide-mouthed, holding loose material.
  raw: { body: 'w-40 h-40 rounded-b-xl rounded-t-sm', hasRim: true, shadow: 'w-44' },
};

/**
 * Number of travelling highlight bands standing in for surface detail on the
 * vessel — reflections, wax grain, the ripple in hand-blown glass. Three is
 * enough that roughly one and a half are on the visible face at any moment, so
 * the surface always reads as moving without ever looking striped.
 */
const SURFACE_BANDS = 3;

/** Full turn, in radians. The rotation phase is tracked in turns, not degrees. */
const TAU = Math.PI * 2;

/**
 * How far a surface feature travels, as a percentage of *its own* width, to carry
 * its centre from one limb of the vessel to the other.
 *
 * A feature `w` wide inside a body `W` wide must move ±`W/2`, which is
 * ±`50 · W/w` percent of itself. Expressing it this way keeps the motion correct
 * for every vessel in `VESSEL_GEOMETRY` without measuring anything: the widths
 * are already authored as percentages of the body.
 */
const TRAVEL = {
  /** Bands are `w-[18%]` → 50 × 100/18. */
  band: 278,
  /** The label is `w-[62%]` → 50 × 100/62. */
  label: 81,
} as const;

/** Seconds for one full turn of the vessel. */
const ROTATION_DURATION = 22;

/**
 * Peak opacity per band, at the moment it faces the viewer. Uneven on purpose —
 * equal bands at equal spacing read as a barber's pole, whereas one pronounced
 * reflection and two faint ones read as glass.
 */
const BAND_SHEEN = [0.5, 0.26, 0.36];

/**
 * Where a point on the vessel's surface appears, and how it looks, at rotation
 * angle `theta`.
 *
 * This is the whole illusion, and it is less of a trick than it sounds: a jar,
 * pillar, and urli are all solids of revolution, so turning one leaves its
 * *outline* completely unchanged. Only surface features move. Rendering those
 * features under a cylindrical projection is therefore not an approximation of
 * rotation — for this family of shapes it is what rotation actually looks like.
 *
 * - `xPercent` — the feature's centre swings as `sin θ`, fastest across the
 *   front, slowest at the limbs, which is the cue the eye actually reads as
 *   *turning* rather than *sliding*. A constant-speed left-to-right drift is the
 *   one thing that gives the game away.
 * - `scaleX` — `cos θ` foreshortening, so a feature narrows to nothing as it
 *   slips around the edge instead of walking off it at full width.
 * - `facing` — 1 dead ahead, 0 at the limb, negative behind the vessel. Raised
 *   to a fractional power so features hold their brightness across the front and
 *   fall off quickly near the edges, rather than fading the whole way round.
 */
const project = (theta: number, travel: number) => {
  const facing = Math.cos(theta);
  return {
    xPercent: Math.sin(theta) * travel,
    scaleX: Math.max(facing, 0),
    // `** 0.7` on the magnitude, then clamped: nothing on the far side of the
    // vessel is visible through it.
    visibility: facing > 0 ? facing ** 0.7 : 0,
  };
};

/** Neutral jar used when a subcategory has no `visual` authored yet. */
const FALLBACK_VISUAL: CandleVisual = {
  vessel: 'jar',
  waxFrom: '#f1ece2',
  waxTo: '#c9bda9',
  labelNote: 'Artisanal Blend',
};

/** Props for {@link InteractiveCandleCanvas}. */
export interface InteractiveCandleCanvasProps {
  /**
   * Flame intensity ratio from 0 (unlit) to 1 (fully lit), published to the DOM
   * as `--flame-intensity`.
   *
   * Pass `inheritFlameIntensity` instead when the value changes every frame — a
   * scroll-scrubbed flame should not re-render this component sixty times a
   * second.
   */
  flameIntensity: number;
  /**
   * Which candle to render. Omit to fall back to a neutral jar, so the canvas is
   * safe to mount before a subcategory's visual has been authored.
   */
  visual?: CandleVisual;
  /** Label headline — typically the subcategory name. */
  label?: string;
  /** Accent colour for the flame glow. Defaults to brand amber. */
  accentColor?: string;
  /**
   * Stop publishing `flameIntensity` and inherit `--flame-intensity` from an
   * ancestor instead, letting a parent scrub ignition with GSAP.
   *
   * This exists because the alternative — forwarding a ref so the parent can
   * write the variable on this node — has React set the inline `style` from
   * `flameIntensity` on every render and silently clobber whatever GSAP put
   * there. Not declaring the variable here leaves exactly one writer.
   * `HeroChamber` is the caller; see {@link CandleFlame} for the wider rationale.
   */
  inheritFlameIntensity?: boolean;
  /**
   * Extra classes for the flame's box. Exists so a parent can *mark* the flame
   * for measurement — `HeroChamber` positions its hoisted smoke layer off this
   * node's rect — without querying this component's internal class names.
   */
  flameClassName?: string;
  /** Pauses the rotation tween when `true`. Used to freeze off-screen sections. */
  paused?: boolean;
}

/**
 * InteractiveCandleCanvas renders a procedural candle that reflects the
 * subcategory currently in view: silhouette, wax tone, and label all come from
 * the supplied {@link CandleVisual}, so scrolling through a collection morphs
 * one candle into the next rather than repeating a single generic prop.
 *
 * Built from CSS gradients, SVG, and transforms — no WebGL, no 3D library. Wax
 * colours are injected inline because they are per-item data, not a finite set
 * Tailwind could pre-generate. The flame itself is {@link CandleFlame}.
 *
 * The candle appears to turn, but nothing is rotated: the body holds still while
 * highlights and the label travel across its face under a cylindrical projection.
 * See {@link project} for why that is the accurate rendering rather than a
 * shortcut, and the rotation `useGSAP` below for what `rotateY` did instead.
 *
 * The turn loops forever, so it is gated behind `useReducedMotion()`; with motion
 * reduced the candle renders lit and still, face-on.
 */
export const InteractiveCandleCanvas: React.FC<InteractiveCandleCanvasProps> = ({
  flameIntensity = 1,
  visual,
  label = 'Lumora',
  accentColor = '#f59e0b',
  inheritFlameIntensity = false,
  flameClassName,
  paused = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bodyShapeRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const rotationTweenRef = useRef<gsap.core.Tween | null>(null);

  const resolved = visual ?? FALLBACK_VISUAL;
  const geometry = VESSEL_GEOMETRY[resolved.vessel];
  const prefersReducedMotion = useReducedMotion();

  /*
   * Ambient rotation, done as surface motion rather than as `rotateY` on the
   * body.
   *
   * A CSS `rotateY` on a flat element has it pass through zero width at 90° and
   * 270° — the vessel vanished to a hairline twice a turn, then showed its
   * mirrored back face for half the cycle. Solving that in real 3D would mean a
   * WebGL renderer and a model per vessel, roughly 150 KB of library plus meshes,
   * to recover a silhouette that never changes in the first place.
   *
   * So the body holds still and the *surface* turns: highlights and label swing
   * across the front on a sine, foreshorten on a cosine, and disappear round the
   * limb. The outline stays honest at every angle because for a solid of
   * revolution the outline genuinely is constant. See {@link project}.
   *
   * One tween drives one phase value and an `onUpdate` writes every feature from
   * it, so all of them share a single clock and cannot drift apart. The flame is
   * outside this entirely — it owns its own transform in {@link CandleFlame}, and
   * a flame shouldn't rotate with the wax anyway.
   */
  useGSAP(
    () => {
      const bands = gsap.utils.toArray<HTMLElement>('.candle-band');
      const label = labelRef.current;

      /** Places one feature at rotation angle `theta`. Shared by both branches. */
      const place = (el: HTMLElement, theta: number, travel: number, sheen: number) => {
        const { xPercent, scaleX, visibility } = project(theta, travel);
        gsap.set(el, { xPercent, scaleX, opacity: visibility * sheen });
      };

      // Reduced motion: the same vessel, stopped. Features are placed through
      // `project()` at phase 0 rather than all shoved to centre, so this is a
      // frozen frame of the rotation — one highlight facing you, the others
      // foreshortened at the limbs, label square on and legible.
      //
      // They must be placed, not skipped: bands and label render `opacity-0` so
      // the loop can position them before their first paint, so an early return
      // would leave the product unnamed and the surface flat.
      if (prefersReducedMotion) {
        bands.forEach((band, index) =>
          place(
            band,
            (index / bands.length) * TAU,
            TRAVEL.band,
            BAND_SHEEN[index % BAND_SHEEN.length]
          )
        );
        if (label) gsap.set(label, { xPercent: 0, scaleX: 1, opacity: 1 });
        return;
      }

      const phase = { turns: 0 };

      rotationTweenRef.current = gsap.to(phase, {
        turns: 1,
        duration: ROTATION_DURATION,
        repeat: -1,
        ease: 'none',
        paused,
        onUpdate: () => {
          // Bands are evenly spaced around the vessel, so as one leaves the front
          // another is already arriving.
          bands.forEach((band, index) =>
            place(
              band,
              (phase.turns + index / bands.length) * TAU,
              TRAVEL.band,
              BAND_SHEEN[index % BAND_SHEEN.length]
            )
          );

          if (label) {
            const { xPercent, scaleX, visibility } = project(phase.turns * TAU, TRAVEL.label);
            gsap.set(label, {
              xPercent,
              scaleX,
              // Squared, so the label is legible only while it genuinely faces
              // you and doesn't linger as unreadable smeared type at the limb.
              opacity: visibility ** 2,
            });
          }
        },
      });
    },
    { scope: containerRef, dependencies: [prefersReducedMotion, resolved.vessel] }
  );

  useEffect(() => {
    if (!rotationTweenRef.current) return;
    if (paused) {
      rotationTweenRef.current.pause();
    } else {
      rotationTweenRef.current.resume();
    }
  }, [paused]);

  // Morph when the active subcategory changes. Tweening scale rather than
  // swapping instantly is what makes this read as one candle reshaping itself.
  useGSAP(
    () => {
      if (prefersReducedMotion || !bodyShapeRef.current) return;

      gsap.fromTo(
        bodyShapeRef.current,
        { scaleY: 0.86, scaleX: 1.08, opacity: 0.4 },
        { scaleY: 1, scaleX: 1, opacity: 1, duration: 0.7, ease: 'power3.out' }
      );
    },
    { scope: containerRef, dependencies: [resolved.vessel, resolved.waxFrom, prefersReducedMotion] }
  );

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={`Illustration of a ${resolved.vessel} candle: ${label}`}
      className="relative flex h-80 w-64 items-center justify-center sm:h-96 sm:w-72"
      // One variable feeds both the flame and its cast glow, so they can never
      // drift out of step. Omitted entirely when the caller owns it, leaving the
      // value to inherit.
      style={
        inheritFlameIntensity
          ? undefined
          : ({ '--flame-intensity': flameIntensity } as React.CSSProperties)
      }
    >
      {/* Flame glow — the light this candle throws into its immediate
          surroundings.

          A radial gradient rather than a solid circle behind `blur-3xl`: the
          falloff is authored instead of filtered, so its shape is controllable
          and it costs no per-frame filter pass on an element whose opacity
          changes on every scroll frame. */}
      <div
        className="pointer-events-none absolute h-[34rem] w-[34rem]"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 46%, ${accentColor} 0%, transparent 62%)`,
          opacity: 'calc(var(--flame-intensity, 1) * 0.4)',
        }}
      />

      {/*
        The flame sits in the column but outside the vessel, and doesn't take part
        in the surface rotation at all: a flame always faces the viewer.

        Keeping it in normal flow rather than absolutely positioning it means the
        wick stays glued to the flame's base at every vessel height, with no
        per-vessel offset to maintain.
      */}
      <div className="relative flex flex-col items-center">
        {/* Flame. Overlaps the wick by a hair so the two never separate as it
            grows. */}
        <CandleFlame className={cn('relative z-20 -mb-1.5 h-14 w-6', flameClassName)} />

        {/* Wick */}
        <div className="z-10 h-3.5 w-[3px] rounded-t-full bg-stone-800 dark:bg-stone-300" />

        {/* Vessel and its shadow. The group no longer rotates — the outline of a
            solid of revolution is the same at every angle, so only what's *on*
            the surface moves. */}
        <div className="relative flex flex-col items-center">
          {/* Vessel body. `overflow-hidden` is what makes the illusion close:
              surface features are clipped by the silhouette, so they curve out of
              sight at the vessel's edge instead of sliding past it. */}
          <div
            ref={bodyShapeRef}
            className={cn(
              'relative overflow-hidden border border-white/30 shadow-2xl',
              geometry.body
            )}
            style={{
              backgroundImage: `linear-gradient(105deg, ${resolved.waxFrom}, ${resolved.waxTo})`,
            }}
          >
            {/* Specular sheen. Fixed, not travelling — this is the window the
                room is lit by, and a reflection of the environment stays put
                while the object turns under it. */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/35 to-transparent" />

            {/* Curvature shading: permanently dark at both limbs, bright down the
                centre. Static, and it does half the work — it establishes the
                body as round, so the travelling bands are read as features moving
                over a cylinder rather than as stripes on a flat panel. */}
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.34)_0%,rgba(0,0,0,0.1)_18%,rgba(255,255,255,0.16)_45%,rgba(0,0,0,0.12)_78%,rgba(0,0,0,0.36)_100%)]" />

            {/*
              Self-shadowing. This is the counter-intuitive half of lighting a
              candle: the brighter the flame, the *darker* the vessel's own body
              gets.

              The wick sits above the wax, so the vessel is lit from directly
              overhead by a source it also occludes. Its outer wall receives
              almost nothing, and the eye reads that contrast — bright room, dark
              object — as the object being the light source. Brightening the wax
              along with the flame is what makes a CSS candle look like a lamp
              instead: it reads as glowing *through*, which only frosted glass
              does.

              Anchored top-centre, at the wick, and driven by the same
              `--flame-intensity` as everything else, so it deepens as the flame
              grows and lifts as it dies — no separate tween to keep in sync, and
              the "shadow behaves with flame size" requirement holds by
              construction rather than by coincidence. The lower stops are
              stronger because the base of a vessel is furthest from the flame and
              closest to the surface bouncing light back.
            */}
            <div
              className={cn(
                'pointer-events-none absolute inset-0',
                // Light mode: far weaker, and brown rather than near-black. A
                // candle in a bright room is shadowed by its own flame just the
                // same, but the room bounces light back into that shadow from
                // every surface. Reusing the dark-mode strength here turned the
                // wax charcoal against a cream page — read as grubby, not lit.
                'bg-[radial-gradient(120%_105%_at_50%_0%,transparent_6%,rgba(96,70,40,0.07)_45%,rgba(78,56,30,0.16)_80%,rgba(66,47,24,0.23)_100%)]',
                // Dark mode: the full effect. Contrast against a near-black
                // chamber is what makes the candle read as the light source.
                'dark:bg-[radial-gradient(120%_105%_at_50%_0%,transparent_4%,rgba(28,18,6,0.30)_42%,rgba(20,12,4,0.62)_78%,rgba(16,9,3,0.80)_100%)]'
              )}
              style={{ opacity: 'var(--flame-intensity, 1)' }}
            />

            {/* Travelling surface features. Positioned centred and moved by
                `xPercent`, so `project()` needs no knowledge of the vessel's
                pixel width. Full height and soft-edged: a highlight on a curved
                surface has no hard vertical boundary. */}
            {Array.from({ length: SURFACE_BANDS }, (_, index) => (
              <div
                key={index}
                className="candle-band pointer-events-none absolute inset-y-0 left-[41%] w-[18%] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.85),transparent)] opacity-0 blur-[2px]"
              />
            ))}

            {/* Glass rim, container-style vessels only. Above the self-shadow so
                the mouth of the jar stays crisp — and correctly so: the rim is
                the one part of the vessel the flame genuinely does illuminate,
                being level with it rather than below. It warms as the flame
                grows, which is what sells the shadow beneath it as *shadow*
                rather than the whole candle simply being dimmed. */}
            {geometry.hasRim && (
              <div
                className="absolute inset-x-0 top-0 z-10 h-2.5 border-b border-white/40 bg-white/25"
                // Space-separated `rgb()` because `calc()` in the alpha slot is
                // only valid in the modern syntax, not legacy comma `rgba()`.
                style={{
                  boxShadow:
                    'inset 0 1px 6px rgb(253 224 71 / calc(var(--flame-intensity, 1) * 0.75))',
                }}
              />
            )}

            {/* Granulated fill, for the raw-materials vessel. */}
            {resolved.vessel === 'raw' && (
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.5)_1px,transparent_1.5px)] bg-[length:7px_7px] opacity-70" />
            )}

            {/* Label. Suppressed on urli and sculpture, whose form *is* the
                product — a paper label would fight the silhouette.

                It travels with the surface, because a label is stuck to the jar:
                leaving it centred while highlights swept past would read as the
                jar being still and something else moving. Width is a percentage
                so `TRAVEL.label` stays correct across vessels; `opacity-0` until
                the tween places it, and reduced motion sets it face-on. */}
            {resolved.vessel !== 'urli' && resolved.vessel !== 'sculpture' && (
              <div
                ref={labelRef}
                className="absolute left-[19%] top-1/3 z-10 w-[62%] rounded-lg border border-amber-500/30 bg-stone-950/80 p-2.5 text-center opacity-0 shadow-inner backdrop-blur-md"
              >
                <span className="block truncate text-[10px] font-semibold uppercase tracking-widest text-amber-400">
                  {label}
                </span>
                <span className="block truncate text-[9px] font-light italic text-stone-300">
                  {resolved.labelNote}
                </span>
              </div>
            )}
          </div>

          {/* Cast shadow. Grows with the flame, because an unlit candle in a dark
              room casts nothing — the shadow only exists once there's a light to
              cast it. Kept at a floor of 0.28 rather than 0 so the vessel never
              looks like it's floating while unlit; the rest is flame-driven. */}
          <div
            className={cn(
              'mt-2 h-5 rounded-full blur-md',
              // Warm brown and lighter on a cream page; near-black in the dark
              // chamber. Pure black at full strength on light mode read as a hole
              // punched in the page rather than a shadow on a surface.
              'bg-[rgb(88_62_34/calc(0.16+var(--flame-intensity,1)*0.20))]',
              'dark:bg-[rgb(0_0_0/calc(0.28+var(--flame-intensity,1)*0.34))]',
              geometry.shadow
            )}
            style={{ transform: 'scaleX(calc(0.88 + var(--flame-intensity, 1) * 0.12))' }}
          />
        </div>
      </div>
    </div>
  );
};
