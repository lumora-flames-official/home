import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Compass, PhoneCall, Home, BookOpen, LayoutGrid, Moon, Sun, Menu, X } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useTheme } from '../../context';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { cn } from '../../lib/utils';
import { DESIGN_TOKENS } from '../../theme/designSystem';

/** A single top-level destination in the global navigation. */
interface NavItem {
  /** Absolute router path, so it can be matched by `NavLink`. */
  to: string;
  /** Human-readable label, rendered in both the inline bar and the drawer. */
  label: string;
  /** Lucide icon component; sized by the consumer via `className`. */
  icon: React.ComponentType<{ className?: string }>;
}

/*
 * Order is the reader's journey, not alphabetical: browse the ideas, then see what is
 * actually available, then the brand, then get in touch. `Collections` and `Catalog` are
 * adjacent because they are two views of the same content and link into each other.
 */
const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/collections', label: 'Collections', icon: Compass },
  { to: '/catalog', label: 'Catalog', icon: LayoutGrid },
  { to: '/about', label: 'Our Story', icon: BookOpen },
  { to: '/contact', label: 'Contact', icon: PhoneCall },
];

/**
 * Viewport width at which the inline link bar replaces the drawer. Must stay in
 * sync with the `md:` Tailwind variant used below — if the media query and the
 * CSS breakpoint disagree, the drawer can be left mounted while its trigger is
 * hidden, leaving no way to dismiss it.
 */
const DESKTOP_BREAKPOINT_QUERY = '(min-width: 768px)';

/** Selector for elements that participate in the header's focus trap. */
const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled])';

/** Shared icon-button styling with a 44x44px tap target (WCAG 2.5.5). */
const ICON_BUTTON_CLASS =
  'inline-flex h-11 w-11 items-center justify-center rounded-full text-stone-800 dark:text-stone-200 ' +
  'transition-colors hover:bg-stone-200/50 dark:hover:bg-stone-800/50 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-stone-50 dark:focus-visible:ring-offset-stone-950';

/**
 * Navbar renders the global floating glass navigation pill, the theme toggle,
 * and — below the `md` breakpoint — a collapsible drawer with a dimmed
 * backdrop. Active state is derived from the current route rather than local
 * state, so deep links stay in sync.
 *
 * Responsive behaviour:
 * - `< md` (phones): hamburger + animated drawer, backdrop, body scroll lock
 *   and focus trap.
 * - `md` (tablet portrait): text-only inline links at tightened spacing, so
 *   four items plus the wordmark fit an iPad without wrapping.
 * - `>= lg`: icons return alongside the labels at full spacing.
 *
 * Accessibility:
 * - The drawer dismisses on `Escape`, backdrop tap, route change, and on resize
 *   past {@link DESKTOP_BREAKPOINT_QUERY}.
 * - Focus moves into the drawer on open, is trapped within the header while
 *   open, and returns to the trigger on an explicit dismiss.
 * - All GSAP motion is skipped when the user prefers reduced motion.
 */
export const Navbar: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();

  /** Whether the drawer should be *visible*. Drives the open/close animation. */
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  /**
   * Whether the drawer is in the DOM. Lags {@link isMenuOpen} on close so the
   * exit tween can finish playing before unmount.
   */
  const [isDrawerMounted, setIsDrawerMounted] = useState(false);

  const headerRef = useRef<HTMLElement>(null);
  const logoRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  /** Mounts the drawer, then flips it open so the enter tween has a target. */
  const openMenu = useCallback(() => {
    setIsDrawerMounted(true);
    setIsMenuOpen(true);
  }, []);

  /**
   * Closes the drawer.
   *
   * @param restoreFocus Move focus back to the hamburger trigger. Pass `true`
   * for explicit dismissals (Escape, backdrop tap) so keyboard users are not
   * stranded on a removed element, and `false` for implicit ones (following a
   * link, route change) where stealing focus would be disorienting.
   */
  const closeMenu = useCallback(
    (restoreFocus = false) => {
      setIsMenuOpen(false);
      // With no exit tween to await, unmount in the same commit.
      if (prefersReducedMotion) setIsDrawerMounted(false);
      // Handled here rather than in an effect: the trigger stays mounted, so a
      // synchronous focus call in the event handler is both valid and simpler.
      if (restoreFocus) menuButtonRef.current?.focus();
    },
    [prefersReducedMotion]
  );

  // Entrance animation: pill drops in, wordmark pops, links stagger.
  useGSAP(
    () => {
      if (prefersReducedMotion) {
        gsap.set([headerRef.current, logoRef.current, '.nav-item'], { clearProps: 'all' });
        return;
      }

      const tl = gsap.timeline({ defaults: { ease: 'power3.out', duration: 0.8 } });

      tl.fromTo(headerRef.current, { y: -60, opacity: 0 }, { y: 0, opacity: 1 })
        .fromTo(
          logoRef.current,
          { scale: 0.8, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.5 },
          '-=0.4'
        )
        .fromTo(
          '.nav-item',
          { y: -10, opacity: 0 },
          { y: 0, opacity: 1, stagger: 0.08, duration: 0.4 },
          '-=0.3'
        );
    },
    { scope: headerRef, dependencies: [prefersReducedMotion] }
  );

  // Drawer enter/exit. The exit tween owns the unmount via its onComplete.
  useGSAP(
    () => {
      const drawer = drawerRef.current;
      if (!isDrawerMounted || !drawer) return;

      const backdrop = backdropRef.current;

      if (prefersReducedMotion) {
        gsap.set([drawer, backdrop].filter(Boolean), { opacity: 1, y: 0, scale: 1 });
        return;
      }

      if (isMenuOpen) {
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

        if (backdrop) tl.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.25 }, 0);

        tl.fromTo(
          drawer,
          { y: -16, opacity: 0, scale: 0.97 },
          { y: 0, opacity: 1, scale: 1, duration: 0.4 },
          0
        ).fromTo(
          '.drawer-item',
          { y: -8, opacity: 0 },
          { y: 0, opacity: 1, stagger: 0.06, duration: 0.3 },
          0.12
        );

        return;
      }

      const tl = gsap.timeline({
        defaults: { ease: 'power2.in', duration: 0.22 },
        onComplete: () => setIsDrawerMounted(false),
      });

      tl.to(drawer, { y: -12, opacity: 0, scale: 0.98 }, 0);
      if (backdrop) tl.to(backdrop, { opacity: 0 }, 0);
    },
    { scope: headerRef, dependencies: [isMenuOpen, isDrawerMounted, prefersReducedMotion] }
  );

  /*
   * Dismiss on navigation, so the browser's back/forward buttons — which bypass
   * the links' onClick — cannot leave the drawer stranded open. Derived from the
   * route during render instead of in an effect: that skips the extra commit an
   * effect would need, so the stale-open drawer is never painted.
   */
  const [renderedPathname, setRenderedPathname] = useState(location.pathname);
  if (renderedPathname !== location.pathname) {
    setRenderedPathname(location.pathname);
    if (isMenuOpen) {
      setIsMenuOpen(false);
      if (prefersReducedMotion) setIsDrawerMounted(false);
    }
  }

  // Dismiss once the inline link bar takes over, otherwise the drawer would
  // linger with no visible trigger to close it.
  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_BREAKPOINT_QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) closeMenu();
    };

    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, [closeMenu]);

  // Lock background scrolling while the drawer and its backdrop cover the view.
  useEffect(() => {
    if (!isMenuOpen) return;

    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';

    return () => {
      body.style.overflow = previousOverflow;
    };
  }, [isMenuOpen]);

  // Escape to dismiss, plus a Tab cycle confined to the header (wordmark, theme
  // toggle, trigger and drawer links) for as long as the drawer is open.
  useEffect(() => {
    if (!isMenuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu(true);
        return;
      }

      if (event.key !== 'Tab') return;

      const focusables = headerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (!focusables?.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isMenuOpen, closeMenu]);

  // Move focus into the drawer on open so keyboard and screen-reader users land
  // inside the newly revealed content instead of behind it.
  useEffect(() => {
    if (!isMenuOpen) return;
    drawerRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
  }, [isMenuOpen]);

  const isDark = theme === 'dark';

  return (
    <header
      ref={headerRef}
      /*
       * `pointer-events-none` is essential: the header spans the full viewport
       * width, so without it the transparent band around the pill would
       * intercept taps meant for page content underneath. Interactive children
       * opt back in with `pointer-events-auto`. The `env()` padding keeps the
       * pill clear of a notch or a rounded-display corner.
       */
      className="fixed top-0 left-0 right-0 z-50 pointer-events-none px-4 sm:px-8 lg:px-12 pb-4 pt-[max(1rem,env(safe-area-inset-top))]"
    >
      {/* Backdrop. Precedes the pill in DOM order so the pill paints on top. */}
      {isDrawerMounted && (
        <div
          ref={backdropRef}
          onClick={() => closeMenu(true)}
          aria-hidden="true"
          className="md:hidden pointer-events-auto fixed inset-0 bg-stone-950/40 backdrop-blur-sm"
        />
      )}

      <nav
        aria-label="Primary"
        className={cn(
          'pointer-events-auto relative max-w-7xl mx-auto flex items-center justify-between gap-3 rounded-full px-4 py-2 sm:px-6 sm:py-3',
          DESIGN_TOKENS.glass.floatingBtn
        )}
      >
        {/* Wordmark. Type and tracking scale down so it fits a ~360px viewport. */}
        <button
          ref={logoRef}
          type="button"
          onClick={() => {
            closeMenu();
            navigate('/');
          }}
          aria-label="Lumora Flames — go to home"
          className="group flex shrink-0 items-center gap-1.5 rounded-full text-sm sm:text-base lg:text-lg font-light uppercase tracking-[0.12em] sm:tracking-[0.18em] lg:tracking-[0.2em] text-stone-900 dark:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          <span className="font-semibold text-amber-500">LUMORA</span>
          <span className="font-semibold text-stone-900 dark:text-stone-400 transition-colors group-hover:text-amber-400">
            FLAMES
          </span>
        </button>

        {/* Inline links: text-only at `md` (tablet portrait), icons from `lg`. */}
        <div className="hidden md:flex items-center gap-4 lg:gap-7 text-[0.7rem] lg:text-xs uppercase tracking-widest font-medium">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'nav-item relative flex items-center gap-1.5 whitespace-nowrap rounded-sm py-1 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-4 focus-visible:ring-offset-transparent',
                  isActive
                    ? 'text-amber-500 font-semibold'
                    : 'text-stone-900 font-semibold dark:text-stone-300 hover:text-amber-500'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="hidden lg:block w-3.5 h-3.5" />
                  {label}
                  {isActive && (
                    <span className="absolute -bottom-1 left-0 right-0 h-[2px] rounded-full bg-amber-500" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>

        {/* Theme toggle + drawer trigger */}
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to daylight mode' : 'Switch to candle mode'}
            title={isDark ? 'Daylight' : 'Candle Mode'}
            className={ICON_BUTTON_CLASS}
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-stone-700" />
            )}
          </button>

          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => (isMenuOpen ? closeMenu() : openMenu())}
            aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-navigation"
            className={cn(ICON_BUTTON_CLASS, 'md:hidden')}
          >
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Drawer. Height-capped and scrollable for short landscape viewports. */}
      {isDrawerMounted && (
        <nav
          id="mobile-navigation"
          ref={drawerRef}
          aria-label="Mobile"
          className={cn(
            'md:hidden pointer-events-auto relative max-w-7xl mx-auto mt-3 rounded-3xl px-4 py-3',
            'max-h-[calc(100dvh-9rem)] overflow-y-auto overscroll-contain',
            DESIGN_TOKENS.glass.floatingBtn
          )}
        >
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => closeMenu()}
              className={({ isActive }) =>
                cn(
                  'drawer-item flex w-full items-center gap-3 rounded-2xl px-3 py-3 min-h-11 text-xs uppercase tracking-widest font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500',
                  isActive
                    ? 'text-amber-500 font-semibold bg-amber-500/10'
                    : 'text-stone-700 dark:text-stone-300 hover:bg-stone-200/40 dark:hover:bg-stone-800/40'
                )
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
};
