import React, { Suspense, lazy } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  useNavigate,
  useParams,
  Navigate,
} from 'react-router-dom';

import { ThemeProvider } from './context';
import { DESIGN_TOKENS } from './theme/designSystem';
import { CANDLE_CATEGORIES } from './data/categories';

import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { PageTransition } from './components/layout/PageTransition';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { AmbientFlameGlow } from './components/ui/AmbientFlameGlow';
import { RouteFallback } from './components/ui/RouteFallback';

/*
 * Route components are lazy so each page ships as its own chunk. This matters
 * more here than in a typical app: the collection photography is imported by the
 * data module, so an eagerly-imported route drags several megabytes of PNG into
 * the initial bundle.
 *
 * Named exports are re-mapped to `default` because `lazy` requires a module with
 * a default export, and the house convention is named exports only.
 */
const LandingHero = lazy(() =>
  import('./features/landing/LandingHero').then((m) => ({ default: m.LandingHero }))
);
const CollectionsJourney = lazy(() =>
  import('./features/categories/CollectionsJourney').then((m) => ({
    default: m.CollectionsJourney,
  }))
);
const CatalogPage = lazy(() =>
  import('./features/catalog/CatalogPage').then((m) => ({ default: m.CatalogPage }))
);
const AboutStory = lazy(() =>
  import('./features/about/AboutStory').then((m) => ({ default: m.AboutStory }))
);
const ContactChannels = lazy(() =>
  import('./features/contact/ContactChannels').then((m) => ({
    default: m.ContactChannels,
  }))
);

/*
 * The local-only catalog CMS, and the one route that is conditional.
 *
 * `import.meta.env.DEV` is statically replaced by Vite, so in a production build
 * this is `false ? … : null` — the branch is dead code and the dynamic import it
 * contains is unreachable, which means the panel is eliminated from the bundle
 * rather than merely unrouted. That matters because the panel is a write tool: its
 * API only exists while `vite serve` is running (see scripts/catalogDevApi.ts), so
 * a shipped copy would be a form that cannot work, describing endpoints that
 * suggest a backend the site does not have.
 *
 * The panel *also* checks `window.location.hostname`. That second check cannot
 * protect anything by itself — shipped code can be read and skipped — it only
 * turns an honest misconfiguration into a clear message. This gate is the one
 * doing the work.
 */
const UpdateListPanel = import.meta.env.DEV
  ? lazy(() =>
      import('./features/admin/UpdateListPanel').then((m) => ({ default: m.UpdateListPanel }))
    )
  : null;

/**
 * Routes that end without the global footer.
 *
 * `/catalog` is an application surface rather than a page of the site: it has its own
 * fixed header, its own navigation rail, and a list that continues into the next
 * collection when you scroll past the bottom. A footer there is unreachable by design —
 * the reader who scrolls to the end of a collection gets the next one, so anything
 * beneath it can only be arrived at by the auto-advance failing. Its links live in the
 * rail's commission CTA and the global navbar instead.
 */
const FOOTERLESS_ROUTES = new Set(['/catalog']);

/** The global footer, absent on routes that own their full viewport. */
const SiteFooter: React.FC = () => {
  const { pathname } = useLocation();
  return FOOTERLESS_ROUTES.has(pathname) ? null : <Footer />;
};

/** Standard page shell: max width, gutters, and clearance for the fixed navbar. */
const PageShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <main className="min-h-screen">
    <div
      className={`${DESIGN_TOKENS.layout.maxWidth} mx-auto ${DESIGN_TOKENS.layout.paddingX} ${DESIGN_TOKENS.layout.headerOffset}`}
    >
      {children}
    </div>
  </main>
);

/* ==========================================================================
   1. HOME (/)
   Full-bleed like the collections story: the hero fills the viewport and two
   sections run edge-to-edge, so it opts out of PageShell and each contained
   section applies its own gutters.
   ========================================================================== */
const HomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen">
      <LandingHero
        /*
         * Deep-links straight into the journey rather than via `/category/:id`. That
         * route still works, but it is now a redirect — sending a home CTA through it
         * would cost the reader a visible extra hop for nothing.
         */
        onSelectCategory={(id) => navigate({ pathname: '/collections', hash: `#${id}` })}
        onOpenCollectionsStory={() => navigate('/collections')}
      />
    </main>
  );
};

/* ==========================================================================
   2. COLLECTIONS JOURNEY (/collections)
   Full-bleed and self-pinning, so it opts out of PageShell's gutters. The hash
   carries the reader's position — `#<categoryId>/<varietyId>` — which is what
   lets `/catalog` link back to exactly where someone left.
   ========================================================================== */
const CollectionsPage: React.FC = () => (
  <main className="min-h-screen">
    <CollectionsJourney />
  </main>
);

/* ==========================================================================
   3. CATALOG (/catalog)
   Every stocked variety's products. Previously a retired redirect: the old
   `/catalog` was a searchable grid of *collections* that duplicated the home
   page. This one lists individual candles with prices and SKUs, which did not
   exist then — the URL is reused, the page is not.
   ========================================================================== */
const CatalogRoute: React.FC = () => (
  <main className="min-h-screen">
    <CatalogPage />
  </main>
);

/* ==========================================================================
   4. RETIRED COLLECTION ROUTE (/category/:categoryId)
   The journey absorbed this page. Kept as a redirect because six places still
   point here — the footer's collection list, promo slide CTAs, two campaign
   cards, the home tiles and the index rail — plus anything already published.
   ========================================================================== */
const CategoryRedirect: React.FC = () => {
  const { categoryId } = useParams<{ categoryId: string }>();
  const exists = CANDLE_CATEGORIES.some((c) => c.id === categoryId);

  /*
   * An unknown slug drops the hash rather than passing it through. Landing at the
   * top of the journey is a legible outcome; a hash naming a collection that does
   * not exist would be silently ignored, which looks the same but leaves a broken
   * link in the address bar to be copied and shared again.
   */
  return <Navigate to={exists ? `/collections#${categoryId}` : '/collections'} replace />;
};

/* ==========================================================================
   4. BRAND STORY (/about)
   ========================================================================== */
const AboutPage: React.FC = () => (
  <PageShell>
    <AboutStory />
  </PageShell>
);

/* ==========================================================================
   5. ENQUIRY CHANNELS (/contact)
   Direct messaging links, not a form. There is no backend and nothing is
   persisted — the page hands the reader off to WhatsApp or Instagram with the
   brief pre-typed. `SubCategoryShowcase` passes `state.categoryTitle` here, and
   `ContactChannels` reads it to name the collection in that pre-typed message.
   ========================================================================== */
const ContactPage: React.FC = () => (
  <main className={`min-h-screen ${DESIGN_TOKENS.layout.headerOffset} px-4 pb-24`}>
    <ContactChannels />
  </main>
);

/* ==========================================================================
   6. MASTER APP
   ========================================================================== */
export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        {/**
         * basename comes from Vite's `base`, so a subpath deploy needs no code change.
         * Without it, every <Route path="/about"> would try to match the full pathname
         * "/LummoraFlames/pr-12/about" and fall through to the * redirect - a preview
         * that loads the home page and nothing else.
         */}
        <Router basename={import.meta.env.BASE_URL}>
          <div className="relative min-h-screen w-full bg-stone-50 text-stone-900 transition-colors duration-500 dark:bg-stone-950 dark:text-stone-100">
            <AmbientFlameGlow />

            <div className="relative z-10">
              <Navbar />

              <PageTransition>
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/collections" element={<CollectionsPage />} />
                    <Route path="/catalog" element={<CatalogRoute />} />
                    {/*
                      Retired routes, kept so previously-published links never 404.
                      `/category/:id` carries its collection across as a hash so the
                      link still lands where it meant to; `/category/:id/details`
                      listed the same varieties the journey now walks through and has
                      no position worth preserving.
                    */}
                    <Route path="/category/:categoryId" element={<CategoryRedirect />} />
                    <Route
                      path="/category/:categoryId/details"
                      element={<Navigate to="/collections" replace />}
                    />
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/contact" element={<ContactPage />} />
                    {/*
                      Dev-only, and absent rather than guarded in production — so on
                      a deployed build this falls through to the * redirect below,
                      which is exactly the 404 behaviour the route should have.
                    */}
                    {UpdateListPanel && (
                      <Route
                        path="/update-list"
                        element={
                          <PageShell>
                            <UpdateListPanel />
                          </PageShell>
                        }
                      />
                    )}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </PageTransition>

              <SiteFooter />
            </div>
          </div>
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
