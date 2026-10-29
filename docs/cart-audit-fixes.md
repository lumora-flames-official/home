# Cart & Checkout Audit — Prioritized Fix List

Adversarial audit of the zero-backend WhatsApp commerce flow.
Ordered by severity: P0 = data loss, P1 = corruption, P2 = UX integrity, P3 = edge/operational.

## P0 — Data-Loss Bugs (fix before any real orders)

- [ ] **1. Cart cleared before WhatsApp confirmed**
  `CartDrawer.tsx:413` — `onSent()` calls `clear()` synchronously after `window.open()`.
  Popup blocked or failed = cart gone, no WhatsApp window, no recovery.
  **Fix:** Add confirmation gate. Only clear after user explicitly confirms "I sent it."

- [ ] **2. `window.open` popup-blocked in form submit**
  `CartDrawer.tsx:101` — `handleSubmit` uses `e.preventDefault()` then `window.open`.
  Many mobile browsers (Samsung, Mi, UC) treat this as non-user-initiated.
  **Fix:** Replace with `<a href>` navigation like `ProductCard` already does.

- [ ] **3. URL truncation on large carts**
  Encoded `wa.me` URL exceeds ~2,083 chars at ~10 items on Android.
  Message arrives truncated, studio receives half an order.
  **Fix:** Measure `encodeURIComponent` output length before opening. Warn or chunk if over threshold.

## P1 — Corruption / Silent Failures

- [ ] **4. Cart schema drift after deploy**
  Full `CatalogProduct` stored in `localStorage`. Any field rename = `₹NaN` in cart.
  **Fix:** Store only `{sku, qty, categoryTitle, varietyName}` in localStorage. Hydrate product data from `catalog.json` at load time. Dead SKUs shown as "no longer available."

- [ ] **5. Stale content-hashed image URLs in cart**
  Deploy changes image hashes; cart stores old URLs; images 404 in drawer.
  **Fix:** Resolved automatically by fix #4 (hydrate from catalog).

- [ ] **6. In-app browser localStorage isolation**
  Instagram/Facebook WebView uses separate storage jar. User adds items, switches to WhatsApp, returns in real browser — cart gone.
  **Fix:** Detect WebView user agent, show "open in browser" banner.

## P2 — UX Integrity

- [ ] **7. No cross-tab cart sync**
  Two tabs, two cart states, possible duplicate/partial order.
  **Fix:** Add `StorageEvent` listener in `CartContext` to re-read on external writes.

- [ ] **8. Price drift between add and checkout**
  Cart snapshot preserves price-at-add-time. CMS price change = customer submits old price.
  **Fix:** Revalidate against catalog at checkout step. Surface diff if changed.

- [ ] **9. Quantity inflation from dual add paths**
  `ProductCard` adds 1 (increments existing), `ProductDialog` adds N (also increments).
  User expects "set to 3" but gets "existing + 3".
  **Fix:** Clarify semantics or show cumulative total on add.

## P3 — Edge Cases & Operational

- [ ] **10. WhatsApp Desktop QR login drops prefilled text**
  **Fix:** Add copy-to-clipboard fallback for desktop users.

- [ ] **11. No order idempotency**
  Duplicate submission produces duplicate orders.
  **Fix:** Embed timestamp + short hash as pseudo order-ID in commission message.

- [ ] **12. Zero operational tooling**
  **Fix:** Document Google Sheets schema, SKU transcription rules, handoff protocol.

---

P0 items form a compound kill chain: large cart + popup blocked + premature clear = **complete irrecoverable order loss**. Fix all three before taking real orders.
