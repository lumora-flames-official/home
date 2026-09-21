import React from 'react';
import { Link } from 'react-router-dom';
import { Camera, Users, Bookmark, MessageCircle, Play, Briefcase } from 'lucide-react';
import { CANDLE_CATEGORIES } from '../../data/categories';
import { INSTAGRAM, whatsappLink } from '../../data/contact';
import { cn } from '../../lib/utils';
import { DESIGN_TOKENS } from '../../theme/designSystem';

/** An external social destination. */
interface SocialLink {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /**
   * Destination URL. These are placeholders until the real handles exist —
   * `href="#"` would scroll to top and read as broken, so each points at the
   * platform root instead.
   */
  href: string;
}

/**
 * Social links. Instagram and WhatsApp are the two real enquiry channels and
 * come from `data/contact.ts` — the same source the About page's enquiry panel
 * uses, so a changed number cannot go stale in one place and not the other. The
 * rest are still platform-root placeholders; replace each `href` as the accounts
 * go live and the layout needs no changes.
 *
 * Icons are generic glyphs, not brand logos: lucide-react v1 removed every brand
 * icon (Instagram, Facebook, YouTube, LinkedIn), so there is nothing to import.
 * Each link carries an `aria-label` and `title` with the platform name, so the
 * destination is unambiguous despite the neutral glyph. If real logos are wanted
 * later, add `simple-icons` — don't reach for a second icon library casually.
 */
const SOCIAL_LINKS: SocialLink[] = [
  { label: INSTAGRAM.label, icon: Camera, href: INSTAGRAM.url },
  { label: 'WhatsApp', icon: MessageCircle, href: whatsappLink() },
  { label: 'Facebook', icon: Users, href: 'https://facebook.com' },
  { label: 'Pinterest', icon: Bookmark, href: 'https://pinterest.com' },
  { label: 'YouTube', icon: Play, href: 'https://youtube.com' },
  { label: 'LinkedIn', icon: Briefcase, href: 'https://linkedin.com' },
];

/** Site-wide navigation links grouped under the "Explore" column. */
const EXPLORE_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/collections', label: 'Collections' },
  { to: '/catalog', label: 'Catalog' },
  { to: '/about', label: 'Our Story' },
  { to: '/contact', label: 'Bespoke Concierge' },
];

/**
 * Footer closes every page with the wordmark, collection links, and the brand's
 * social placeholders.
 *
 * Rendered once in `App` below the router outlet, so it appears on all routes.
 * Social icons open in a new tab with `rel="noreferrer"` — without it the target
 * page can read `window.opener`.
 */
export const Footer: React.FC = () => (
  <footer className="mt-24 border-t border-stone-200 bg-stone-100/60 dark:border-stone-800 dark:bg-stone-950/60">
    <div
      className={cn(
        'mx-auto py-16 sm:py-20',
        DESIGN_TOKENS.layout.maxWidth,
        DESIGN_TOKENS.layout.paddingX
      )}
    >
      <div className="grid gap-12 lg:grid-cols-12">
        {/* Brand statement */}
        <div className="space-y-5 lg:col-span-5">
          <p className="flex items-center gap-2 text-lg font-light uppercase tracking-[0.2em]">
            <span className="font-semibold text-amber-500">LUMORA</span>
            <span className="font-extralight text-stone-500 dark:text-stone-400">FLAMES</span>
          </p>
          <p
            className={cn(
              DESIGN_TOKENS.typography.body,
              'max-w-sm text-stone-600 dark:text-stone-400'
            )}
          >
            Hand-poured artisanal soy wax — bespoke blends, sculptural wax art, and festive urlis,
            made in small batches to order.
          </p>
          <Link
            to="/contact"
            className={cn(
              'inline-flex items-center gap-2 text-amber-600 transition-colors hover:text-amber-500 dark:text-amber-400',
              DESIGN_TOKENS.typography.button
            )}
          >
            Commission a candle
            <span aria-hidden="true" className="h-px w-8 bg-current" />
          </Link>
        </div>

        {/* Collections */}
        <nav aria-labelledby="footer-collections" className="space-y-4 lg:col-span-4">
          <h2
            id="footer-collections"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-900 dark:text-stone-100"
          >
            Collections
          </h2>
          <ul className="space-y-2.5">
            {CANDLE_CATEGORIES.map((category) => (
              <li key={category.id}>
                {/* Deep-links into the journey. `/category/:id` still resolves here via
                    a redirect, but going through it would cost a visible extra hop. */}
                <Link
                  to={{ pathname: '/collections', hash: `#${category.id}` }}
                  className="text-sm font-light text-stone-600 transition-colors hover:text-amber-500 dark:text-stone-400 dark:hover:text-amber-400"
                >
                  {category.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Explore */}
        <nav aria-labelledby="footer-explore" className="space-y-4 lg:col-span-3">
          <h2
            id="footer-explore"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-900 dark:text-stone-100"
          >
            Explore
          </h2>
          <ul className="space-y-2.5">
            {EXPLORE_LINKS.map(({ to, label }) => (
              <li key={to}>
                <Link
                  to={to}
                  className="text-sm font-light text-stone-600 transition-colors hover:text-amber-500 dark:text-stone-400 dark:hover:text-amber-400"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Social + legal */}
      <div className="mt-14 flex flex-col-reverse gap-6 border-t border-stone-200 pt-8 sm:flex-row sm:items-center sm:justify-between dark:border-stone-800">
        <p className="text-xs font-light text-stone-500 dark:text-stone-500">
          © {new Date().getFullYear()} Lumora Flames. Hand-poured in small batches.
        </p>

        <ul className="flex flex-wrap items-center gap-1">
          {SOCIAL_LINKS.map(({ label, icon: Icon, href }) => (
            <li key={label}>
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={label}
                title={label}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-stone-600 transition-colors hover:bg-stone-200/60 hover:text-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:text-stone-400 dark:hover:bg-stone-800/60 dark:hover:text-amber-400"
              >
                <Icon className="h-4 w-4" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  </footer>
);
