import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { CatalogProduct } from '../../types/catalog';
import type { CartItem } from '../../types/cart';

interface CartContextValue {
  items: CartItem[];
  /**
   * Adds a product to the cart, or increments its quantity if it already exists.
   *
   * @param product The candle to add.
   * @param context Display titles for the commission WhatsApp message.
   * @param quantity How many to add (default 1). Capped at 99 total.
   */
  addItem: (
    product: CatalogProduct,
    context: { categoryTitle: string; varietyName: string },
    quantity?: number
  ) => void;
  /** Removes a product from the cart by SKU. */
  removeItem: (sku: string) => void;
  /** Sets a product's quantity to an exact value. qty ≤ 0 removes the item. */
  updateQty: (sku: string, qty: number) => void;
  /** Empties the cart. */
  clear: () => void;
  /** Total number of individual units across all line items. */
  totalCount: number;
  /** Sum of (price × qty) for all items, in whole rupees. */
  totalPrice: number;
  /** Whether the cart drawer is currently open. */
  isOpen: boolean;
  /** Opens the cart drawer. */
  open: () => void;
  /** Closes the cart drawer. */
  close: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = 'lumora-cart';

function readStorage(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

/** Provides cart state and the open/close toggle for {@link CartDrawer}. */
export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(readStorage);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback(
    (
      product: CatalogProduct,
      context: { categoryTitle: string; varietyName: string },
      quantity = 1
    ) => {
      setItems((prev) => {
        const existing = prev.find((i) => i.product.sku === product.sku);
        if (existing) {
          return prev.map((i) =>
            i.product.sku === product.sku
              ? { ...i, quantity: Math.min(i.quantity + quantity, 99) }
              : i
          );
        }
        return [...prev, { product, quantity: Math.min(quantity, 99), ...context }];
      });
    },
    []
  );

  const removeItem = useCallback((sku: string) => {
    setItems((prev) => prev.filter((i) => i.product.sku !== sku));
  }, []);

  const updateQty = useCallback((sku: string, qty: number) => {
    if (qty <= 0) {
      setItems((prev) => prev.filter((i) => i.product.sku !== sku));
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.product.sku === sku ? { ...i, quantity: Math.min(qty, 99) } : i))
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const totalCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.product.priceInr * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQty,
        clear,
        totalCount,
        totalPrice,
        isOpen,
        open,
        close,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

/** Returns the cart context. Must be called within {@link CartProvider}. */
// eslint-disable-next-line react-refresh/only-export-components
export const useCart = (): CartContextValue => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};
