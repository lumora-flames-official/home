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
 * Builds the pre-typed WhatsApp message for a cart commission.
 *
 * Format mirrors {@link buildProductEnquiryMessage} but covers multiple line
 * items and includes a delivery address so the studio can quote shipping.
 */
export const buildCartCommissionMessage = (items: CartItem[], address: DeliveryAddress): string => {
  const itemLines = items.map(
    (item) =>
      `• ${item.product.sku} | ${item.product.name} | Qty: ${item.quantity} | ${formatPrice(item.product.priceInr)} each`
  );
  const total = items.reduce((sum, i) => sum + i.product.priceInr * i.quantity, 0);

  return [
    '🕯️ Lumora Flames — Order Enquiry',
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

/** Returns a `wa.me` deep link with the cart commission message pre-typed. */
export const cartWhatsAppLink = (items: CartItem[], address: DeliveryAddress): string =>
  `https://wa.me/${WHATSAPP.number}?text=${encodeURIComponent(
    buildCartCommissionMessage(items, address)
  )}`;
