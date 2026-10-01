import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Minus, Plus, Send, ShoppingBag, Trash2, X } from 'lucide-react';
import type { CartItem } from '../../types/cart';
import { useCart } from './CartContext';
import { cartWhatsAppLink, type DeliveryAddress } from '../../lib/cartWhatsApp';
import { formatPrice } from '../../lib/formatPrice';
import { cn } from '../../lib/utils';
import { DESIGN_TOKENS } from '../../theme/designSystem';

// ─── Cart item row ────────────────────────────────────────────────────────────

interface CartItemRowProps {
  item: CartItem;
  onRemove: (sku: string) => void;
  onUpdateQty: (sku: string, qty: number) => void;
}

const CartItemRow: React.FC<CartItemRowProps> = ({ item, onRemove, onUpdateQty }) => (
  <li className="flex gap-3 border-b border-stone-200/70 py-3 last:border-0 dark:border-stone-800/70">
    <img
      src={item.product.imageUrl}
      alt={item.product.name}
      className="h-16 w-16 shrink-0 rounded-xl bg-stone-100 object-cover dark:bg-stone-900"
    />
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-light leading-snug">{item.product.name}</p>
          <p className="tabular-nums text-xs text-stone-500 dark:text-stone-400">
            {item.product.sku}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onRemove(item.product.sku)}
          aria-label={`Remove ${item.product.name}`}
          className="shrink-0 rounded p-1 text-stone-400 transition-colors hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-0.5 rounded-full border border-stone-200 bg-stone-100/50 dark:border-stone-700 dark:bg-stone-900/50">
          <button
            type="button"
            onClick={() => onUpdateQty(item.product.sku, item.quantity - 1)}
            aria-label={`Decrease quantity of ${item.product.name}`}
            className="grid h-7 w-7 place-items-center rounded-full text-stone-600 transition-colors hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:text-stone-400 dark:hover:text-stone-100"
          >
            <Minus className="h-3 w-3" aria-hidden="true" />
          </button>
          <span className="w-6 select-none text-center text-sm font-light tabular-nums">
            {item.quantity}
          </span>
          <button
            type="button"
            onClick={() => onUpdateQty(item.product.sku, Math.min(item.quantity + 1, 99))}
            aria-label={`Increase quantity of ${item.product.name}`}
            className="grid h-7 w-7 place-items-center rounded-full text-stone-600 transition-colors hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:text-stone-400 dark:hover:text-stone-100"
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
        <span className="text-sm font-light tabular-nums">
          {formatPrice(item.product.priceInr * item.quantity)}
        </span>
      </div>
    </div>
  </li>
);

// ─── Address step ─────────────────────────────────────────────────────────────

interface AddressStepProps {
  items: CartItem[];
  totalPrice: number;
  onBack: () => void;
  onClose: () => void;
  onSent: () => void;
}

const AddressStep: React.FC<AddressStepProps> = ({
  items,
  totalPrice,
  onBack,
  onClose,
  onSent,
}) => {
  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const address: DeliveryAddress = {
      name: data.get('name') as string,
      phone: data.get('phone') as string,
      addressLine: data.get('addressLine') as string,
      locality: data.get('locality') as string,
      city: data.get('city') as string,
      pincode: data.get('pincode') as string,
    };
    window.open(cartWhatsAppLink(items, address), '_blank', 'noreferrer');
    onSent();
  };

  const inputClass =
    'w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-light ' +
    'placeholder:text-stone-400 transition-colors ' +
    'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent ' +
    'dark:border-stone-700 dark:bg-stone-900 dark:placeholder:text-stone-600';

  const labelClass =
    'block text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400';

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-stone-200/70 p-4 dark:border-stone-800/70">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to cart"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-stone-300 text-stone-600 transition-colors hover:border-amber-500 hover:text-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-stone-700 dark:text-stone-400"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-light tracking-tight">Delivery Details</h2>
          <p className="tabular-nums text-xs text-stone-500 dark:text-stone-400">
            {items.length} {items.length === 1 ? 'item' : 'items'} · {formatPrice(totalPrice)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close cart"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-stone-300 text-stone-600 transition-colors hover:border-amber-500 hover:text-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-stone-700 dark:text-stone-400"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain p-4">
          <div className="space-y-1">
            <label htmlFor="cart-name" className={labelClass}>
              Full Name
            </label>
            <input
              id="cart-name"
              name="name"
              type="text"
              required
              autoComplete="name"
              placeholder="Your name"
              className={inputClass}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="cart-phone" className={labelClass}>
              Phone
            </label>
            <input
              id="cart-phone"
              name="phone"
              type="tel"
              required
              autoComplete="tel"
              pattern="[0-9+\s\-]{8,15}"
              placeholder="10-digit mobile number"
              className={inputClass}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="cart-address" className={labelClass}>
              Address
            </label>
            <input
              id="cart-address"
              name="addressLine"
              type="text"
              required
              autoComplete="street-address"
              placeholder="Flat / House no., Building, Street"
              className={inputClass}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="cart-locality" className={labelClass}>
              Locality
            </label>
            <input
              id="cart-locality"
              name="locality"
              type="text"
              required
              placeholder="Area, Colony"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="cart-city" className={labelClass}>
                City
              </label>
              <input
                id="cart-city"
                name="city"
                type="text"
                required
                autoComplete="address-level2"
                placeholder="New Delhi"
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="cart-pincode" className={labelClass}>
                Pincode
              </label>
              <input
                id="cart-pincode"
                name="pincode"
                type="text"
                required
                pattern="[0-9]{6}"
                placeholder="110001"
                className={inputClass}
              />
            </div>
          </div>

          <p className="pt-1 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
            WhatsApp will open with your order pre-filled. Review before sending.
          </p>
        </div>

        <div className="border-t border-stone-200/70 p-4 dark:border-stone-800/70">
          <button
            type="submit"
            className={cn(
              'inline-flex w-full items-center justify-center gap-2 rounded-full bg-amber-500 px-6 py-3.5 text-stone-950 transition-colors hover:bg-amber-400',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 dark:focus-visible:ring-offset-stone-950',
              DESIGN_TOKENS.typography.button
            )}
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            Send order on WhatsApp
          </button>
        </div>
      </form>
    </div>
  );
};

// ─── Cart step ────────────────────────────────────────────────────────────────

interface CartStepProps {
  items: CartItem[];
  totalCount: number;
  totalPrice: number;
  onRemove: (sku: string) => void;
  onUpdateQty: (sku: string, qty: number) => void;
  onClose: () => void;
  onCommission: () => void;
}

const CartStep: React.FC<CartStepProps> = ({
  items,
  totalCount,
  totalPrice,
  onRemove,
  onUpdateQty,
  onClose,
  onCommission,
}) => (
  <div className="flex h-full flex-col">
    <div className="flex items-center gap-3 border-b border-stone-200/70 p-4 dark:border-stone-800/70">
      <ShoppingBag className="h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-light tracking-tight">Your Cart</h2>
        {totalCount > 0 && (
          <p className="tabular-nums text-xs text-stone-500 dark:text-stone-400">
            {totalCount} {totalCount === 1 ? 'item' : 'items'} · {formatPrice(totalPrice)}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close cart"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-stone-300 text-stone-600 transition-colors hover:border-amber-500 hover:text-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-stone-700 dark:text-stone-400"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>

    <div className="flex-1 overflow-y-auto overscroll-contain">
      {items.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
          <ShoppingBag
            className="h-10 w-10 text-stone-300 dark:text-stone-700"
            aria-hidden="true"
          />
          <p className="text-sm font-light text-stone-500 dark:text-stone-400">
            Cart is empty. Add candles from the catalog.
          </p>
        </div>
      ) : (
        <ul className="px-4">
          {items.map((item) => (
            <CartItemRow
              key={item.product.sku}
              item={item}
              onRemove={onRemove}
              onUpdateQty={onUpdateQty}
            />
          ))}
        </ul>
      )}
    </div>

    {items.length > 0 && (
      <div className="space-y-3 border-t border-stone-200/70 p-4 dark:border-stone-800/70">
        <div className="flex items-center justify-between">
          <span className="text-sm text-stone-500 dark:text-stone-400">Total</span>
          <span className="text-lg font-light tabular-nums">{formatPrice(totalPrice)}</span>
        </div>
        <button
          type="button"
          onClick={onCommission}
          className={cn(
            'inline-flex w-full items-center justify-center gap-2 rounded-full bg-amber-500 px-6 py-3.5 text-stone-950 transition-colors hover:bg-amber-400',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 dark:focus-visible:ring-offset-stone-950',
            DESIGN_TOKENS.typography.button
          )}
        >
          Commission these candles
        </button>
      </div>
    )}
  </div>
);

// ─── CartDrawer ───────────────────────────────────────────────────────────────

/**
 * Right-side drawer for the shopping cart.
 *
 * Rendered once at the app level (App.tsx) and driven entirely by
 * {@link useCart}'s `isOpen` / `open` / `close`. Two internal steps:
 * 1. Cart items with quantity controls.
 * 2. Delivery address form that builds and opens the WhatsApp commission link.
 *
 * Uses the native `<dialog>` element with `showModal()` for the same reasons as
 * `ProductDialog`: free backdrop, top-layer stacking, Escape to dismiss, and
 * inertness of everything behind it.
 */
export const CartDrawer: React.FC = () => {
  const { items, removeItem, updateQty, totalPrice, totalCount, isOpen, close, clear } = useCart();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<'cart' | 'address'>('cart');

  // Resets step to 'cart' and closes. Called by every dismissal path so the
  // next open always starts on the items list, not the address form.
  const handleClose = () => {
    setStep('cart');
    close();
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      if (!dialog.open) dialog.showModal();
    } else {
      if (dialog.open) dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const { body } = document;
    const prev = body.style.overflow;
    body.style.overflow = 'hidden';
    return () => {
      body.style.overflow = prev;
    };
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      aria-label="Cart"
      onClose={handleClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) handleClose();
      }}
      className={cn(
        'm-0 ml-auto h-dvh w-[min(26rem,100vw)] max-w-full p-0',
        'overflow-hidden rounded-none sm:rounded-l-3xl',
        'backdrop:bg-stone-950/70 backdrop:backdrop-blur-sm',
        'bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100'
      )}
    >
      {step === 'address' ? (
        <AddressStep
          items={items}
          totalPrice={totalPrice}
          onBack={() => setStep('cart')}
          onClose={handleClose}
          onSent={() => {
            clear();
            handleClose();
          }}
        />
      ) : (
        <CartStep
          items={items}
          totalCount={totalCount}
          totalPrice={totalPrice}
          onRemove={removeItem}
          onUpdateQty={updateQty}
          onClose={handleClose}
          onCommission={() => setStep('address')}
        />
      )}
    </dialog>
  );
};
