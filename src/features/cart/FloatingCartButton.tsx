import React from 'react';
import { ShoppingBag } from 'lucide-react';
import { useCart } from './CartContext';
import { cn } from '../../lib/utils';

/**
 * Floating cart shortcut for mobile, shown only when the cart has items and
 * the drawer is closed. Positioned above the page's bottom chrome so it does
 * not cover content or the mobile nav bar.
 *
 * Hidden at `md` and up: the navbar has a persistent cart icon there.
 */
export const FloatingCartButton: React.FC = () => {
  const { totalCount, isOpen, open } = useCart();

  if (totalCount === 0 || isOpen) return null;

  return (
    <button
      type="button"
      onClick={open}
      aria-label={`Open cart — ${totalCount} ${totalCount === 1 ? 'item' : 'items'}`}
      className={cn(
        'fixed bottom-20 right-4 z-40 md:hidden',
        'grid h-14 w-14 place-items-center rounded-full',
        'bg-amber-500 text-stone-950 shadow-lg shadow-amber-500/30',
        'transition-colors hover:bg-amber-400',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2',
        'focus-visible:ring-offset-stone-50 dark:focus-visible:ring-offset-stone-950'
      )}
    >
      <ShoppingBag className="h-5 w-5" aria-hidden="true" />
      <span
        aria-hidden="true"
        className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-stone-950 text-[0.625rem] font-bold tabular-nums text-white"
      >
        {totalCount > 99 ? '99+' : totalCount}
      </span>
    </button>
  );
};
