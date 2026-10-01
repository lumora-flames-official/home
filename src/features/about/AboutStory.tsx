import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { Flame, Sparkles, MessageCircle, Camera, ArrowRight, ArrowUpRight } from 'lucide-react';
import { ASSET_IMAGES } from '../../data/assets';
import { INSTAGRAM, whatsappLink } from '../../data/contact';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { cn } from '../../lib/utils';
import { DESIGN_TOKENS } from '../../theme/designSystem';
import { EASE, DURATION, settleInstantly } from '../../lib/animations';
import { ResponsiveImage } from '../../components/ui/ResponsiveImage';

gsap.registerPlugin(ScrollTrigger);

/** One step in the craft timeline. */
interface ProcessStep {
  /** Stage label, e.g. "Blend". */
  title: string;
  /** What happens at this stage. */
  body: string;
}

/**
 * The making of a candle, start to finish. Rendered as a vertical timeline whose
 * connecting rule draws itself as the reader scrolls.
 */
const PROCESS_STEPS: ProcessStep[] = [
  {
    title: 'Blend',
    body: 'Fragrance notes are weighed by hand and tested in small pours over several days, because a scent that reads beautifully cold can turn flat once lit.',
  },
  {
    title: 'Pour',
    body: 'Soy wax is brought to temperature and poured slowly into each vessel. Poured too hot it pulls away from the glass; too cool and the surface sets uneven.',
  },
  {
    title: 'Cure',
    body: 'Every candle rests for a fortnight. Curing is what lets the fragrance bind into the wax — the single step that cannot be rushed.',
  },
  {
    title: 'Finish',
    body: 'Wicks are trimmed, labels applied by hand, and each piece is inspected against the light before it is boxed.',
  },
];

/** A studio value or vision statement. */
interface Pillar {
  /** Short heading. */
  title: string;
  /** Supporting sentence. */
  body: string;
}

/** Vision pillars shown as a three-column set beneath the story. */
const PILLARS: Pillar[] = [
  {
    title: 'Small batches, always',
    body: 'We would rather sell out than scale into a factory. Batch sizes stay small enough that one person can inspect every piece.',
  },
  {
    title: 'Materials you could eat off',
    body: 'Soy wax, cotton and wood wicks, phthalate-free fragrance. We sell the same raw materials we pour with — that is the accountability.',
  },
  {
    title: 'Made to be given',
    body: 'Most of what leaves the studio is a gift, so the object matters as much as the scent. Nothing ships in packaging we would be embarrassed to hand over.',
  },
];

/**
 * AboutStory is the brand narrative page: an opening statement, the studio
 * portrait, the four-stage craft timeline, vision pillars, and the enquiry panel
 * that closes it.
 *
 * The panel used to invite readers to visit and smell the candles, which
 * promised a shopfront that does not exist — there is no studio open to walk
 * into. It now offers the three channels that do exist, ordered by how little
 * they ask of the reader: WhatsApp, Instagram, then the concierge form. Handles
 * and numbers live in `data/contact.ts`, not here.
 *
 * The timeline's connecting rule is scroll-scrubbed via `scaleY`, so it appears
 * to draw itself downward as the reader descends — the page's signature moment.
 * Because it animates a transform rather than `height`, it never triggers layout.
 */
export const AboutStory: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  useGSAP(
    () => {
      if (prefersReducedMotion) {
        settleInstantly(['.about-intro > *', '.about-step', '.about-pillar']);
        gsap.set('.timeline-rule', { scaleY: 1 });
        return;
      }

      gsap.fromTo(
        '.about-intro > *',
        { y: 34, opacity: 0 },
        { y: 0, opacity: 1, duration: DURATION.slow, stagger: 0.1, ease: EASE.enter }
      );

      // Parallax on the studio portrait.
      gsap.fromTo(
        '.about-portrait-img',
        { yPercent: -6 },
        {
          yPercent: 6,
          ease: EASE.scrub,
          scrollTrigger: {
            trigger: '.about-portrait',
            start: 'top bottom',
            end: 'bottom top',
            scrub: 1,
          },
        }
      );

      // The rule draws itself as the timeline scrolls past.
      gsap.fromTo(
        '.timeline-rule',
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: EASE.scrub,
          scrollTrigger: {
            trigger: '.about-timeline',
            start: 'top 70%',
            end: 'bottom 60%',
            scrub: 1,
          },
        }
      );

      gsap.fromTo(
        '.about-step',
        { x: -28, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: DURATION.base,
          stagger: 0.15,
          ease: EASE.enter,
          scrollTrigger: { trigger: '.about-timeline', start: 'top 72%', once: true },
        }
      );

      gsap.fromTo(
        '.about-pillar',
        { y: 34, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: DURATION.base,
          stagger: 0.1,
          ease: EASE.enter,
          scrollTrigger: { trigger: '.about-pillars', start: 'top 80%', once: true },
        }
      );
    },
    { scope: rootRef, dependencies: [prefersReducedMotion] }
  );

  return (
    <div ref={rootRef} className={cn(DESIGN_TOKENS.layout.sectionGap, 'pb-24 pt-6')}>
      {/* Opening statement */}
      <section className="about-intro max-w-4xl space-y-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
          <Flame className="h-3.5 w-3.5 text-amber-500" /> Our Story
        </span>

        <h1
          className={cn(DESIGN_TOKENS.typography.heroTitle, 'text-stone-900 dark:text-stone-100')}
        >
          We started with <span className="font-light italic text-amber-500">one</span> stubborn
          candle.
        </h1>

        <p className="max-w-2xl text-base font-light leading-relaxed text-stone-600 dark:text-stone-400 sm:text-xl">
          It tunnelled, it smoked, and it smelled of nothing halfway down. Working out why took
          months of ruined wax — and somewhere in that mess the studio began. Lumora Flames exists
          because a candle should be as considered as the room it is lit in.
        </p>
      </section>

      {/* Studio portrait */}
      <section className="about-portrait relative overflow-hidden rounded-[2.5rem]">
        <div className="aspect-[4/5] sm:aspect-[16/9]">
          {/* Inside `PageShell`'s gutters, capped by `layout.maxWidth` at 1600px. */}
          <ResponsiveImage
            picture={ASSET_IMAGES.categories.bespoke}
            alt="Inside the Lumora Flames studio, where each candle is poured by hand."
            sizes="(min-width: 1600px) 1344px, 100vw"
            className="about-portrait-img absolute inset-0 h-[112%] w-full -translate-y-[6%] object-cover"
          />
        </div>
        <div className={cn('absolute inset-0', DESIGN_TOKENS.overlay.scrimBottom)} />
        <div className="absolute inset-x-0 bottom-0 p-7 sm:p-12">
          <p className="max-w-xl text-lg font-light leading-relaxed text-white sm:text-2xl">
            &ldquo;Nothing leaves the studio that we would not be happy to give to someone we
            like.&rdquo;
          </p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
            The studio, on why batches stay small
          </p>
        </div>
      </section>

      {/* Craft timeline */}
      <section aria-labelledby="process-heading" className="about-timeline space-y-12">
        <div className="max-w-2xl space-y-4">
          <span className={DESIGN_TOKENS.typography.eyebrow}>How a candle is made</span>
          <h2 id="process-heading" className={DESIGN_TOKENS.typography.sectionTitle}>
            <span className="text-stone-900 dark:text-stone-100">Four stages,</span>{' '}
            <span className="font-semibold text-amber-500">six weeks</span>
          </h2>
        </div>

        <div className="relative pl-10 sm:pl-14">
          {/* Track and the rule that draws over it. `origin-top` makes the
              scaleY tween grow downward rather than from the centre. */}
          <div
            aria-hidden="true"
            className="absolute left-[7px] top-2 h-[calc(100%-1rem)] w-px bg-stone-200 dark:bg-stone-800 sm:left-[11px]"
          />
          <div
            aria-hidden="true"
            className="timeline-rule absolute left-[7px] top-2 h-[calc(100%-1rem)] w-px origin-top bg-amber-500 sm:left-[11px]"
          />

          <ol className="space-y-14">
            {PROCESS_STEPS.map((step, index) => (
              <li key={step.title} className="about-step relative">
                <span
                  aria-hidden="true"
                  className="absolute -left-10 top-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-amber-500 bg-stone-50 dark:bg-stone-950 sm:-left-14 sm:h-6 sm:w-6"
                />
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 tabular-nums dark:text-amber-400">
                  Stage {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-2 text-2xl font-light tracking-tight text-stone-900 dark:text-stone-100 sm:text-3xl">
                  {step.title}
                </h3>
                <p
                  className={cn(
                    DESIGN_TOKENS.typography.body,
                    'mt-3 max-w-xl text-stone-600 dark:text-stone-400'
                  )}
                >
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Vision pillars */}
      <section aria-labelledby="pillars-heading" className="about-pillars space-y-12">
        <div className="max-w-2xl space-y-4">
          <span className={DESIGN_TOKENS.typography.eyebrow}>What we hold to</span>
          <h2 id="pillars-heading" className={DESIGN_TOKENS.typography.sectionTitle}>
            <span className="text-stone-900 dark:text-stone-100">Our</span>{' '}
            <span className="font-semibold text-amber-500">vision</span>
          </h2>
        </div>

        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-14">
          {PILLARS.map((pillar, index) => (
            <div
              key={pillar.title}
              className="about-pillar space-y-4 border-t border-stone-200 pt-6 dark:border-stone-800"
            >
              <span className="text-xs font-semibold tabular-nums text-amber-500">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="text-xl font-light tracking-tight text-stone-900 dark:text-stone-100 sm:text-2xl">
                {pillar.title}
              </h3>
              <p
                className={cn(DESIGN_TOKENS.typography.body, 'text-stone-600 dark:text-stone-400')}
              >
                {pillar.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Enquiry panel */}
      <section
        aria-labelledby="enquiry-heading"
        className={cn('rounded-[2.5rem] p-9 sm:p-14', DESIGN_TOKENS.glass.card)}
      >
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between lg:gap-16">
          <div className="max-w-xl space-y-4">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
              <Sparkles className="h-3.5 w-3.5" /> Made to order
            </span>
            <h2
              id="enquiry-heading"
              className={cn(
                DESIGN_TOKENS.typography.sectionTitle,
                'text-stone-900 dark:text-stone-100'
              )}
            >
              Tell us what you want made
            </h2>
            <p className={cn(DESIGN_TOKENS.typography.body, 'text-stone-600 dark:text-stone-400')}>
              Nothing here is sitting on a shelf — every piece is poured after you ask for it, which
              means the vessel, the scent and the size are all still open. Message us with the
              occasion and roughly how many you need, and we&apos;ll come back with what is
              possible.
            </p>
            <p className={cn(DESIGN_TOKENS.typography.body, 'text-stone-500 dark:text-stone-500')}>
              WhatsApp is quickest. {INSTAGRAM.handle} is where the work in progress goes, so it is
              the best place to see what a blend actually looks like poured.
            </p>
          </div>

          {/*
            Two ways to start, ranked, plus a way to see the rest. WhatsApp first
            because a message costs a reader nothing and lands with us instantly.

            The third was an inquiry form; it is now a link to `/contact`, which
            lists the same channels alongside the studio's hours and lead time.
            It is worth keeping because some readers want to know *when* they
            will hear back before they commit to starting a chat — which is what
            the form's "when may we call you" field was really negotiating.

            The two direct channels are `<a>`, not buttons with handlers: they
            leave the site, so they need middle-click, long-press and "copy link"
            to behave — which only a real anchor gives. The third stays a
            `<button>` with `navigate`, and carries `ArrowRight` rather than
            `ArrowUpRight`, because it moves within the site.
          */}
          <div className="flex w-full shrink-0 flex-col gap-3 lg:w-auto lg:min-w-[19rem]">
            <a
              href={whatsappLink()}
              target="_blank"
              rel="noreferrer"
              className={cn(
                'inline-flex items-center justify-between gap-4 rounded-full bg-amber-500 px-7 py-4 text-stone-950 shadow-lg transition-colors hover:bg-amber-400',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-50 dark:focus-visible:ring-offset-stone-950',
                DESIGN_TOKENS.typography.button
              )}
            >
              <span className="inline-flex items-center gap-2.5">
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Message on WhatsApp
              </span>
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </a>

            <a
              href={INSTAGRAM.url}
              target="_blank"
              rel="noreferrer"
              className={cn(
                'inline-flex items-center justify-between gap-4 rounded-full border border-stone-300 px-7 py-4 text-stone-800 transition-colors hover:border-amber-500 hover:text-amber-600',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-50',
                'dark:border-stone-700 dark:text-stone-200 dark:hover:border-amber-400 dark:hover:text-amber-400 dark:focus-visible:ring-offset-stone-950',
                DESIGN_TOKENS.typography.button
              )}
            >
              <span className="inline-flex items-center gap-2.5">
                <Camera className="h-4 w-4" aria-hidden="true" />
                See the work on Instagram
              </span>
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </a>

            <button
              type="button"
              onClick={() => navigate('/contact')}
              className={cn(
                'inline-flex items-center gap-2.5 rounded-full px-7 py-4 text-stone-600 transition-colors hover:text-amber-600',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-50',
                'dark:text-stone-400 dark:hover:text-amber-400 dark:focus-visible:ring-offset-stone-950',
                DESIGN_TOKENS.typography.button
              )}
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              Studio hours and every channel
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
