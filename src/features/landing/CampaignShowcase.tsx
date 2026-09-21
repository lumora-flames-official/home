import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { ScanSquare, Sparkles, CalendarHeart, Handshake } from 'lucide-react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { cn } from '../../lib/utils';
import { DESIGN_TOKENS } from '../../theme/designSystem';
import { EASE, DURATION, settleInstantly } from '../../lib/animations';

/** One promotional placement in the campaign wall. */
interface Campaign {
  id: string;
  /** Small label naming the channel or occasion. */
  kicker: string;
  /** Headline. Kept short — these tiles are read at a glance. */
  title: string;
  /** One-line supporting copy. */
  body: string;
  /** Channel icon. */
  icon: React.ComponentType<{ className?: string }>;
  /** Visible CTA text. */
  cta: string;
  /** Route pushed on activation. */
  href: string;
  /**
   * Column span at `lg`. The deliberately uneven mix is what makes this read as
   * a curated campaign wall rather than another uniform card grid.
   */
  span: string;
}

/**
 * Campaign placements. These are presentation slots, not commitments — swapping
 * copy here is how a seasonal push goes live. Every `href` must resolve to a
 * real route in `App.tsx` or the tile dead-ends.
 */
const CAMPAIGNS: Campaign[] = [
  {
    id: 'festival',
    kicker: 'Seasonal Campaign',
    title: 'The Festival of Light, cast in wax',
    body: 'Brass urlis and floral diyas, hand-poured in limited numbers for the season.',
    icon: CalendarHeart,
    cta: 'See the festive edit',
    href: '/collections#traditional-festive',
    span: 'lg:col-span-7',
  },
  {
    id: 'instagram',
    kicker: 'Instagram',
    title: '@lumoraflames',
    body: 'Behind the pour — workshop films, new moulds, and scent experiments.',
    icon: ScanSquare,
    cta: 'Follow the studio',
    href: '/contact',
    span: 'lg:col-span-5',
  },
  {
    id: 'collab',
    kicker: 'Collaborations',
    title: 'For hotels, weddings & hampers',
    body: 'Bespoke blends and custom labelling at volume, with your identity on the glass.',
    icon: Handshake,
    cta: 'Start a conversation',
    href: '/contact',
    span: 'lg:col-span-5',
  },
  {
    id: 'makers',
    kicker: 'For Makers',
    title: 'Raw materials, studio grade',
    body: 'The same wax, wicks, moulds and oils we pour with — available by the kilo.',
    icon: Sparkles,
    cta: 'Browse materials',
    href: '/collections#raw-materials',
    span: 'lg:col-span-7',
  },
];

/**
 * CampaignShowcase renders the landing page's promotional wall — the slots the
 * brief reserves for Instagram campaigns, seasonal pushes, and collaborations.
 *
 * Presented as an intentionally uneven 12-column mosaic on desktop rather than a
 * uniform card row, so it reads as curated placements. Tiles are glass surfaces
 * over a warm amber wash instead of photography, which keeps them from competing
 * with the collection showcases directly above.
 */
export const CampaignShowcase: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  useGSAP(
    () => {
      if (prefersReducedMotion) {
        settleInstantly(['.campaign-heading > *', '.campaign-tile']);
        return;
      }

      gsap.registerPlugin(ScrollTrigger);

      const tl = gsap.timeline({
        defaults: { ease: EASE.enter },
        scrollTrigger: { trigger: rootRef.current, start: 'top 80%', once: true },
      });

      tl.fromTo(
        '.campaign-heading > *',
        { y: 24, opacity: 0 },
        { y: 0, opacity: 1, duration: DURATION.base, stagger: 0.08 }
      ).fromTo(
        '.campaign-tile',
        { y: 40, opacity: 0, scale: 0.97 },
        { y: 0, opacity: 1, scale: 1, duration: DURATION.base, stagger: 0.1 },
        '-=0.3'
      );
    },
    { scope: rootRef, dependencies: [prefersReducedMotion] }
  );

  return (
    <section ref={rootRef} aria-labelledby="campaign-heading" className="space-y-10">
      <div className="campaign-heading max-w-2xl space-y-4">
        <span className={DESIGN_TOKENS.typography.eyebrow}>Currently at the studio</span>
        <h2 id="campaign-heading" className={DESIGN_TOKENS.typography.sectionTitle}>
          <span className="text-stone-900 dark:text-stone-100">Campaigns &amp;</span>{' '}
          <span className="font-semibold text-amber-500">Collaborations</span>
        </h2>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        {CAMPAIGNS.map(({ id, kicker, title, body, icon: Icon, cta, href, span }) => (
          <button
            key={id}
            type="button"
            onClick={() => navigate(href)}
            className={cn(
              'campaign-tile group relative flex min-h-[16rem] flex-col justify-between overflow-hidden rounded-[2rem] p-7 text-left transition-transform duration-500 sm:p-9',
              'hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-50 dark:focus-visible:ring-offset-stone-950',
              DESIGN_TOKENS.glass.card,
              span
            )}
          >
            {/* Warm corner wash — firelight, not a second accent hue. Rests
                dimmed and brightens on hover; `opacity-150` doesn't exist, so
                the wash previously never changed. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-amber-500/20 opacity-60 blur-3xl transition-opacity duration-700 group-hover:opacity-100 dark:bg-amber-500/10"
            />

            <div className="relative space-y-4">
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
                <Icon className="h-3.5 w-3.5" />
                {kicker}
              </span>
              <h3 className="text-2xl font-light tracking-tight text-stone-900 dark:text-stone-100 sm:text-3xl">
                {title}
              </h3>
              <p
                className={cn(
                  DESIGN_TOKENS.typography.body,
                  'max-w-md text-stone-600 dark:text-stone-400'
                )}
              >
                {body}
              </p>
            </div>

            <span
              className={cn(
                'relative mt-6 inline-flex items-center gap-2 text-amber-600 transition-colors group-hover:text-amber-500 dark:text-amber-400',
                DESIGN_TOKENS.typography.button
              )}
            >
              {cta}
              <span
                aria-hidden="true"
                className="h-px w-8 bg-current transition-all duration-300 group-hover:w-14"
              />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
};
