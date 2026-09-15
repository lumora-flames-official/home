import { describe, it, expect } from 'vitest';
import { WHATSAPP, buildBriefMessage, buildProductEnquiryMessage, whatsappLink } from './contact';

/**
 * These assert the contact link, because it is the site's entire conversions
 * path and it fails *silently* - a malformed number makes `wa.me` open an
 * "invalid number" screen rather than erroring, so a typo looks like a working
 * button. CI is the only thing that would catch it.
 */

describe('WhatsApp deep link', () => {
  it('holds a wa.me-usable number: 8-15 digits, no + or space', () => {
    expect(WHATSAPP.number).toMatch(/^\d{8,15}$/);
  });

  it('encodes newlines so the brief survives the query string', () => {
    const url = whatsappLink(buildBriefMessage('Festive Urlis'));
    expect(url).toContain('%0A'); // literal newlines would truncate it
    expect(url).toContain('Festive%20Urlis');
  });

  it('names the collection when given one, and falls back when not', () => {
    expect(buildBriefMessage('Diyas')).toContain('Diyas');
    expect(buildBriefMessage()).toBe(
      [WHATSAPP.prefilledMessage, '', 'Occasion: ', 'Quantity: ', 'Fragrance notes: '].join('\n')
    );
  });
});

/**
 * The product enquiry is the same conversion path one step deeper, and it carries
 * one thing the generic brief does not: the SKU. There is no order system, so that
 * code is the *only* link between an enquiry and a specific listing — if it were
 * dropped or mangled in the query string, the studio would receive a plausible
 * message about an unidentifiable candle. Like a malformed number, that failure is
 * silent: the button works, WhatsApp opens, the text looks fine.
 */
describe('product enquiry deep link', () => {
  const product = { name: 'Amber Glow Jar', sku: 'BESPOKE-V1-01', priceInr: 1200 };
  const context = {
    categoryTitle: 'Bespoke & Personalized',
    varietyName: 'Custom Fragrance Blends',
  };

  it('carries the SKU, name and price into the message', () => {
    const message = buildProductEnquiryMessage({ product, ...context });

    expect(message).toContain('BESPOKE-V1-01');
    expect(message).toContain('Amber Glow Jar');
    expect(message).toContain('1,200'); // formatted, not a bare 1200
    expect(message).toContain('Custom Fragrance Blends');
  });

  it('survives URL encoding intact', () => {
    const url = whatsappLink(buildProductEnquiryMessage({ product, ...context }));

    expect(url.startsWith(`https://wa.me/${WHATSAPP.number}?text=`)).toBe(true);
    expect(url).toContain('BESPOKE-V1-01');
    expect(url).toContain('%0A'); // newlines encoded, not truncating the query

    // The ampersand in "Bespoke & Personalized" is the sharp edge here: unencoded
    // it would start a new query parameter and silently truncate the message at the
    // collection name, losing the brief prompts below it.
    expect(url).not.toContain('&');
    expect(decodeURIComponent(url.split('?text=')[1])).toContain('Bespoke & Personalized');
  });
});
