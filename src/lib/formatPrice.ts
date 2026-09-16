/**
 * Rupee formatting for catalog prices.
 *
 * Prices are stored as whole-rupee numbers (`StoredProduct.priceInr`) rather than
 * as display strings, so exactly one place is allowed to turn one into text —
 * otherwise `₹1,200` and `₹1200` both ship and neither is wrong enough to notice.
 */

/**
 * Built once at module scope rather than per call.
 *
 * `Intl.NumberFormat` is expensive to construct relative to using it, and a
 * product rail formats a price per card on every render.
 *
 * `en-IN` matters beyond the currency symbol: it groups in the Indian system, so
 * 150000 renders as `₹1,50,000` and not `₹150,000`.
 */
const RUPEES = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  // Every price in the catalog is a whole rupee; `₹1,200.00` reads like a receipt.
  maximumFractionDigits: 0,
});

/**
 * Formats a whole-rupee amount for display.
 *
 * @param priceInr Whole rupees, e.g. `1200`.
 * @returns e.g. `₹1,200`.
 */
export const formatPrice = (priceInr: number): string => RUPEES.format(priceInr);
