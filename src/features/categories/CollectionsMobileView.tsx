import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CANDLE_CATEGORIES } from '../../data/categories';
import { parseCollectionHash } from '../../lib/deepLink';
import { cn } from '../../lib/utils';
import { DESIGN_TOKENS } from '../../theme/designSystem';
import { CollectionTabs } from './CollectionTabs';
import { VarietyCard } from './VarietyCard';

/**
 * Mobile-only collections layout: vertical scroll of collection sections,
 * each with a horizontal swipeable row of variety cards.
 *
 * Zero GSAP, zero ScrollTrigger, zero EmberField. Designed to run at full
 * speed on low-end mobile hardware where the desktop pinned-scroll experience
 * would otherwise produce jank from 96+ concurrent infinite tweens.
 *
 * Rendered by `CollectionsJourney` when the viewport is below `lg` (1024px).
 */
export const CollectionsMobileView: React.FC = () => {
  const location = useLocation();
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState(() => {
    const target = parseCollectionHash(location.hash);
    return target ? target.categoryId : CANDLE_CATEGORIES[0].id;
  });

  const activeCategoryRef = useRef(activeCategoryId);

  const scrollToCollection = useCallback((categoryId: string) => {
    activeCategoryRef.current = categoryId;
    setActiveCategoryId(categoryId);
    const section = document.getElementById(`mobile-collection-${categoryId}`);
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const prevHashRef = useRef(location.hash);

  useEffect(() => {
    if (prevHashRef.current === location.hash) return;
    prevHashRef.current = location.hash;

    const target = parseCollectionHash(location.hash);
    if (!target) return;

    const frame = requestAnimationFrame(() => scrollToCollection(target.categoryId));
    return () => cancelAnimationFrame(frame);
  }, [location.hash, scrollToCollection]);

  useEffect(() => {
    const sections = sectionRefs.current.filter(Boolean) as HTMLElement[];
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-category-id');
            if (id && id !== activeCategoryRef.current) {
              activeCategoryRef.current = id;
              setActiveCategoryId(id);
            }
          }
        }
      },
      { rootMargin: '-30% 0px -60% 0px' }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative w-full">
      <CollectionTabs activeCategoryId={activeCategoryId} onSelect={scrollToCollection} />

      <div className="space-y-16 pt-36 pb-24">
        {CANDLE_CATEGORIES.map((category, categoryIndex) => (
          <section
            key={category.id}
            id={`mobile-collection-${category.id}`}
            ref={(node) => {
              sectionRefs.current[categoryIndex] = node;
            }}
            data-category-id={category.id}
            aria-labelledby={`mobile-heading-${category.id}`}
            className="scroll-mt-36"
          >
            <div className={cn(DESIGN_TOKENS.layout.paddingX, 'mx-auto max-w-7xl')}>
              <h2
                id={`mobile-heading-${category.id}`}
                className={cn(
                  DESIGN_TOKENS.typography.sectionTitle,
                  'text-stone-900 dark:text-stone-100'
                )}
              >
                {category.title}
              </h2>
              <p className="mt-2 max-w-xl text-sm font-light leading-relaxed text-stone-600 dark:text-stone-400">
                {category.description}
              </p>
            </div>

            <div
              className={cn(
                'mt-6 flex gap-4 overflow-x-auto px-5 pb-4 snap-x snap-mandatory',
                '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
              )}
            >
              {category.subCategories.map((variety, index) => (
                <VarietyCard
                  key={variety.id}
                  category={category}
                  variety={variety}
                  index={index}
                  total={category.subCategories.length}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};
