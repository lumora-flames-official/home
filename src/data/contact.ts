/**
 * The brand's direct enquiry channels, in one place because they appear in at
 * least two (`AboutStory`'s enquiry panel and `Footer`'s social row) and a
 * number that is right in one and stale in the other is worse than no number.
 *
 * There is no storefront and no checkout — every candle is poured against a
 * specific order — so these links *are* the sales floor. A dead one is a lost
 * enquiry, which is why `assertContactConfigured()` runs below.
 */

import type { CatalogProduct } from '../types/catalog';
import { formatPrice } from '../lib/formatPrice';

/** A social or messaging destination with the handle rendered in copy. */
export interface ContactChannel {
  /** Platform name, used for `aria-label` and `title`. */
  label: string;
  /** What a reader sees, e.g. `@lumoraflames`. */
  handle: string;
  /** Absolute URL. Opened in a new tab by every caller. */
  url: string;
}

/**
 * Instagram profile.
 *
 * Replace `handle` and the tail of `url` together — they are separate fields
 * because the handle is displayed as copy while the URL is followed, and
 * deriving one from the other would break the day the profile moves.
 */
export const INSTAGRAM: ContactChannel = {
  label: 'Instagram',
  handle: '@lumora_flames',
  url: 'https://instagram.com/lumora_flames',
};

/**
 * WhatsApp Business line.
 *
 * `number` must be the full international number as **digits only** — no `+`,
 * no spaces, no dashes, country code first. `wa.me` does not reject a malformed
 * number with an error; it opens WhatsApp on an empty "invalid number" state,
 * so a typo here looks like a working button.
 *
 * `display` is only for showing on screen and may be formatted however reads
 * best. It is currently unused — the enquiry panel links to WhatsApp without
 * printing the number, which keeps it off the page for scrapers. Print it if
 * you would rather people could copy it.
 */
export const WHATSAPP = {
  label: 'WhatsApp',
  /** Digits only, country code first. */
  number: '919873301173',
  /** Human-readable form. Not currently rendered. */
  display: '+91 98733 01173',
  /**
   * Seeded into the chat so the reader is not staring at an empty compose box.
   * Kept short and first-person: the point is to remove the "what do I even
   * say" pause, not to write their enquiry for them.
   */
  prefilledMessage: "Hi Lumora Flames! I'd like to enquire about a custom candle order.",
} as const;

/**
 * Builds the WhatsApp deep link, with the greeting pre-typed.
 *
 * `wa.me` resolves to the app on mobile and WhatsApp Web on desktop, so one
 * href covers both — no user-agent sniffing.
 *
 * @param message Overrides the default greeting, e.g. to name a collection the
 *   reader was looking at.
 * @returns A `https://wa.me/…` URL safe to use as an `href`.
 *
 * @example
 * <a href={whatsappLink()} target="_blank" rel="noreferrer">Message us</a>
 */
export const whatsappLink = (message: string = WHATSAPP.prefilledMessage): string =>
  `https://wa.me/${WHATSAPP.number}?text=${encodeURIComponent(message)}`;

/* ------------------------------------------------------------------ *
 * Brief scaffold
 * ------------------------------------------------------------------ */

/**
 * Fields seeded into the chat as empty labels, so the studio gets the brief in
 * the visitor's *first* message instead of after three rounds of questions.
 *
 * This is the entire replacement for the retired inquiry form's structured
 * fields. A label with a trailing space is a surprisingly strong prompt — most
 * people fill in what is put in front of them, and the ones who delete it have
 * lost nothing, whereas an empty compose box reliably produces "hi, is this
 * available?".
 *
 * Kept to three deliberately. A pre-typed message long enough to scroll reads
 * as a form, which is the friction we just removed.
 */
export const BRIEF_PROMPTS = ['Occasion', 'Quantity', 'Fragrance notes'] as const;

/**
 * Builds the pre-typed enquiry message, optionally naming what the reader was
 * looking at when they clicked through.
 *
 * @param subject Collection or variety the reader arrived from, e.g.
 *   `'Festive Urlis'`. Omit for a generic enquiry.
 * @returns Multi-line message body, ready to hand to {@link whatsappLink}.
 *
 * @example
 * whatsappLink(buildBriefMessage('Festive Urlis'))
 */
export const buildBriefMessage = (subject?: string): string => {
  const opening = subject
    ? `Hi Lumora Flames! I'd like to enquire about ${subject}.`
    : WHATSAPP.prefilledMessage;

  // Blank line between greeting and labels. WhatsApp preserves `\n`, and the gap
  // is what makes the labels read as a list to fill in rather than as prose.
  return [opening, '', ...BRIEF_PROMPTS.map((field) => `${field}: `)].join('\n');
};

/**
 * Brief labels for an enquiry about a *listed* candle, as opposed to a bespoke one.
 *
 * Shorter than {@link BRIEF_PROMPTS} by one field on purpose: the reader picked a
 * product off the rail, so its fragrance is already decided and asking for
 * "Fragrance notes" reads as though the studio didn't notice which candle was
 * clicked. Occasion and quantity are still open questions.
 */
export const PRODUCT_BRIEF_PROMPTS = ['Occasion', 'Quantity'] as const;

/**
 * Builds the pre-typed enquiry for one catalog product.
 *
 * The SKU is the load-bearing part. There is no order system, so this message is
 * the *only* record that ties an enquiry to a specific listing — without a code
 * in it the studio is matching "the amber one" against a rail of amber ones by
 * hand. Price is included for the same reason: it pins what the customer was
 * shown, so a later price change can't turn into a disagreement.
 *
 * @param args.product The product being enquired about.
 * @param args.categoryTitle Human-readable collection title, e.g.
 *   `'Bespoke & Personalized'` — the display title, not the id slug, because this
 *   text is read by a person.
 * @param args.varietyName Human-readable variety name, e.g.
 *   `'Custom Fragrance Blends'`.
 * @returns Multi-line message body, ready to hand to {@link whatsappLink}.
 *
 * @example
 * whatsappLink(buildProductEnquiryMessage({ product, categoryTitle, varietyName }))
 */
export const buildProductEnquiryMessage = ({
  product,
  categoryTitle,
  varietyName,
}: {
  product: Pick<CatalogProduct, 'name' | 'sku' | 'priceInr'>;
  categoryTitle: string;
  varietyName: string;
}): string =>
  [
    `Hi Lumora Flames! I'd like to enquire about ${product.name} (SKU: ${product.sku}), listed at ${formatPrice(product.priceInr)}.`,
    '',
    `Collection: ${categoryTitle} — ${varietyName}`,
    ...PRODUCT_BRIEF_PROMPTS.map((field) => `${field}: `),
  ].join('\n');

/* ------------------------------------------------------------------ *
 * Studio facts
 * ------------------------------------------------------------------ */

/**
 * Sentinel for a fact not yet supplied.
 *
 * Rendering is *skipped* for any value still equal to this, so an unfilled panel
 * ships as a shorter panel rather than showing a customer the word "TBC". The
 * alternative — a hardcoded guess — is worse: a wrong reply window is a promise
 * you didn't know you made.
 */
export const PLACEHOLDER = 'TBC';

/**
 * Operational facts shown on `/contact`.
 *
 * These absorb what the retired form's "when may we call you" field used to
 * negotiate: a reader who can see the reply window and the hours does not need
 * to be asked when to be called.
 *
 * **Fill all four in.** Until you do, `assertContactConfigured` warns in dev and
 * the panel quietly omits the unfilled rows.
 */
export const STUDIO = {
  /** How quickly a message is answered, e.g. `'within 24 hours'`. */
  replyWindow: PLACEHOLDER,
  /** When someone is actually reading messages, e.g. `'10am – 7pm, Mon to Sat'`. */
  hours: PLACEHOLDER,
  /** Where the studio pours, e.g. `'New Delhi, India'`. */
  city: PLACEHOLDER,
  /** Turnaround for a bespoke order, e.g. `'10–14 days'`. */
  leadTime: PLACEHOLDER,
} as const;

/**
 * Warns in dev while the placeholders above are still in place.
 *
 * Deliberately a warning and not a throw: an unfilled handle is a business
 * problem, not a broken build, and throwing would take the whole site down over
 * copy. It runs at import time so it fires once, not per render, and it is
 * stripped from production bundles along with the `import.meta.env.DEV` branch.
 *
 * The reason it exists at all is that both placeholders *look* functional —
 * `instagram.com/lumoraflames` loads a page and `wa.me` opens WhatsApp — so
 * nothing about clicking them says "not configured yet".
 */
const assertContactConfigured = (): void => {
  if (!import.meta.env.DEV) return;

  if (WHATSAPP.number.includes('0000')) {
    console.warn(
      '[contact] WHATSAPP.number is still the placeholder. Set the real number in src/data/contact.ts — digits only, country code first, no + or spaces.'
    );
  }
  if (!/^\d{8,15}$/.test(WHATSAPP.number)) {
    console.warn(
      `[contact] WHATSAPP.number ("${WHATSAPP.number}") is not 8–15 digits. wa.me will open an "invalid number" screen rather than fail visibly.`
    );
  }

  // Same reasoning as the WhatsApp placeholder check above: an unfilled studio
  // panel is invisible in the UI by design, so without this warning you would
  // never learn it was empty until a customer asked a question it answers.
  const unfilled = Object.entries(STUDIO)
    .filter(([, value]) => value === PLACEHOLDER)
    .map(([key]) => key);

  if (unfilled.length > 0) {
    console.warn(
      `[contact] STUDIO facts still unset: ${unfilled.join(', ')}. ` +
        'Each is hidden on /contact until filled in — see src/data/contact.ts.'
    );
  }
};

assertContactConfigured();
