# Order Operations Protocol

How incoming WhatsApp orders are tracked manually until the volume justifies a
backend. Designed for one or two people handling up to ~50 orders/day.

## Google Sheets Schema

One sheet per month, named `Orders — Oct 2026`, etc.

| Column | Example | Notes |
| --- | --- | --- |
| **Ref** | `LF-1028-A3F1` | From the WhatsApp message header. Primary dedup key. |
| **Date** | `2026-10-28` | When the message arrived, not when you logged it. |
| **Customer** | `Priya Sharma` | From the delivery address block. |
| **Phone** | `+91 98765 43210` | From the delivery address block. |
| **Items** | `LF-TF-DW-001 ×2, LF-BE-CF-001 ×1` | SKU × qty, comma-separated. |
| **Total** | `₹3,400` | As shown in the message. Cross-check against current prices. |
| **City** | `New Delhi — 110001` | City + pincode from the message. |
| **Status** | `confirmed` | See status values below. |
| **Shipping** | `Delhivery AWB123456` | Carrier + tracking number once shipped. |
| **Notes** | `Wants gift wrapping` | Anything from the follow-up chat. |

### Status values

Use exactly these (for filtering):

- `new` — logged but not yet acknowledged to the customer
- `confirmed` — acknowledged, payment received or agreed
- `making` — in production
- `shipped` — dispatched, tracking number in Shipping column
- `delivered` — confirmed receipt
- `cancelled` — cancelled by customer or studio, note reason in Notes

## Daily workflow

1. **Morning**: open WhatsApp Business, scan new messages.
2. **Log each order** into Sheets by copying the Ref, items, address, and total.
   The Ref is the dedup key — if you see the same Ref twice, it is a
   duplicate submission (customer tapped twice or resent). Ignore the second.
3. **Acknowledge** each new order in WhatsApp: quote the Ref back so the
   customer knows which order you mean. Example: *"Hi Priya! Got your order
   LF-1028-A3F1. Confirming availability now."*
4. **Update status** as the order moves through production and shipping.

## Handling duplicates

The website adds a unique Ref (`LF-MMDD-XXXX`) to every commission message.
Same Ref = same cart submission. If a customer sends two messages with
different Refs, they are two separate orders (the customer may have changed
items or address between submissions).

If two messages arrive within minutes with identical items but different Refs,
confirm with the customer before logging both — likely a retry after the first
message appeared to fail.

## SKU transcription

Copy SKUs character-by-character from the WhatsApp message. Do not retype from
memory. The format is `LF-XX-YY-NNN`:

- `LF` — Lumora Flames prefix (always)
- `XX` — collection code (2 chars)
- `YY` — variety code (2 chars)
- `NNN` — sequential number

A mistyped SKU ties the order to the wrong product or to nothing. If in doubt,
search the Ref in the WhatsApp thread and re-copy.

## Handoff between team members

If someone else takes over order handling:

1. Filter Sheets to `new` and `confirmed` — these need attention.
2. Skim the WhatsApp thread for any unlogged messages (search for "Order
   Enquiry" to find commission messages).
3. `making` orders are in production — check with whoever is pouring.

## When to move off this system

Consider a proper order backend when any of these become true:

- Consistently >50 orders/day (manual logging becomes the bottleneck)
- Multiple team members handling orders simultaneously (thread confusion)
- Customers asking for self-service tracking (no way to provide it now)
- Payment disputes that need an audit trail beyond chat screenshots
