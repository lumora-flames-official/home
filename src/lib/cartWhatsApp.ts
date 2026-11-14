import type { CartItem } from '../types/cart';
import { formatPrice } from './formatPrice';
import { WHATSAPP } from '../data/contact';

/** Address fields collected before sending the cart commission message. */
export interface DeliveryAddress {
  name: string;
  phone: string;
  addressLine: string;
  locality: string;
  city: string;
  pincode: string;
}

/**
 * Short pseudo order-ID: timestamp-based, readable, unique enough to detect
 * duplicate submissions in a WhatsApp thread. Format: `LF-MMDD-XXXX` where
 * XXXX is the last 4 hex digits of a timestamp hash.
 */
const orderRef = (): string => {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hash = ((now.getTime() * 2654435761) >>> 0).toString(16).slice(-4).toUpperCase();
  return `LF-${mm}${dd}-${hash}`;
};

/**
 * Builds the pre-typed WhatsApp message for a cart commission.
 *
 * Format mirrors {@link buildProductEnquiryMessage} but covers multiple line
 * items and includes a delivery address so the studio can quote shipping.
 * A pseudo order reference is prepended for deduplication.
 */
export const buildCartCommissionMessage = (items: CartItem[], address: DeliveryAddress): string => {
  const itemLines = items.map(
    (item) =>
      `• ${item.product.sku} | ${item.product.name} | Qty: ${item.quantity} | ${formatPrice(item.product.priceInr)} each`
  );
  const total = items.reduce((sum, i) => sum + i.product.priceInr * i.quantity, 0);
  const ref = orderRef();

  return [
    `🕯️ Lumora Flames — Order Enquiry`,
    `Ref: ${ref}`,
    '',
    'Items:',
    ...itemLines,
    '',
    `Total: ${formatPrice(total)}`,
    '',
    'Delivery Address:',
    `Name: ${address.name}`,
    `Phone: ${address.phone}`,
    `Address: ${address.addressLine}, ${address.locality}`,
    `City: ${address.city} — ${address.pincode}`,
  ].join('\n');
};

/**
 * Conservative URL length ceiling. Android Chrome and many mobile WebViews
 * truncate URLs around 2,083 characters; iOS is higher but in-app browsers
 * (Instagram, Facebook) can be lower. 2,000 leaves a margin.
 */
export const WHATSAPP_URL_SAFE_LENGTH = 2000;

/** Returns a `wa.me` deep link with the cart commission message pre-typed. */
export const cartWhatsAppLink = (items: CartItem[], address: DeliveryAddress): string =>
  `https://wa.me/${WHATSAPP.number}?text=${encodeURIComponent(
    buildCartCommissionMessage(items, address)
  )}`;

/** Whether the built URL would exceed the safe length for mobile deep links. */
export const isCartUrlTooLong = (items: CartItem[], address: DeliveryAddress): boolean =>
  cartWhatsAppLink(items, address).length > WHATSAPP_URL_SAFE_LENGTH;
