import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GIFTING_SLIDES, OFFER_SLIDES, REASON_SLIDES } from '../../data/promotions';
import { PromotionalCarouselTemplate1 } from './PromoCarouselTemplate1';
import { PromoCarouselTemplate2 } from './PromoCarouselTemplate2';
import { PromoCarouselTemplate3 } from './PromoCarouselTemplate3';

/**
 * Which promotional placement to render.
 *
 * Each maps to one dataset in `data/promotions.ts` and one template, and each
 * template is a genuinely different format — a photographic slideshow, a
 * typographic band, and a drifting ribbon. Three carousels in a row that all
 * looked alike would read as a page that couldn't decide what to say.
 *
 * - `offers` — full-bleed photography, autoplaying. Reasons to act now.
 * - `reasons` — oversized type, scroll-driven, no imagery. Why own a candle.
 * - `gifting` — drifting ribbon of occasion cards. Several options at once.
 */
export type PromoPlacement = 'offers' | 'reasons' | 'gifting';

/** Props for {@link PromotionalCarousel}. */
export interface PromotionalCarouselProps {
  /** Which placement to render. See {@link PromoPlacement}. */
  placement: PromoPlacement;
  /**
   * Overrides the default `navigate('/collections#:id')` behaviour. Useful when a
   * host page wants to intercept the transition (for example to run an exit
   * animation first).
   */
  onNavigateCollection?: (collectionId: string) => void;
}

/**
 * PromotionalCarousel is the smart container for all three promotional
 * placements: it owns the routing and selects the dataset and template for the
 * requested {@link PromoPlacement}, so a host page just names the placement.
 *
 * The data-in / template-out split is deliberate and load-bearing — templates
 * receive a slide array and a navigation callback, and know nothing about routing
 * or where content comes from. Adding a fourth placement means adding a dataset,
 * a template, and one `case` here. Never fork this container, and never hardcode
 * slide data inside a template.
 *
 * See `docs/promoCarousal.md` for the template concept library.
 */
export const PromotionalCarousel: React.FC<PromotionalCarouselProps> = ({
  placement,
  onNavigateCollection,
}) => {
  const navigate = useNavigate();

  const handleNavigation = (collectionId: string) => {
    if (onNavigateCollection) {
      onNavigateCollection(collectionId);
      return;
    }
    // Deep-links into the journey at the slide's collection. `/category/:id` still
    // redirects here, but routing a slide CTA through it costs a visible extra hop.
    navigate({ pathname: '/collections', hash: `#${collectionId}` });
  };

  switch (placement) {
    case 'reasons':
      return (
        <PromoCarouselTemplate2
          slides={REASON_SLIDES}
          onNavigateCollection={handleNavigation}
          label="Why choose a candle"
        />
      );

    case 'gifting':
      return (
        <PromoCarouselTemplate3
          slides={GIFTING_SLIDES}
          onNavigateCollection={handleNavigation}
          label="Gifting occasions"
        />
      );

    case 'offers':
      return (
        <PromotionalCarouselTemplate1
          slides={OFFER_SLIDES}
          onNavigateCollection={handleNavigation}
          autoSlideInterval={7000}
          label="Current offers and seasonal releases"
        />
      );
  }
};
