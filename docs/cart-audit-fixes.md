# Cart & Checkout Audit — Prioritized Fix List

Adversarial audit of the zero-backend WhatsApp commerce flow.
Ordered by severity: P0 = data loss, P1 = corruption, P2 = UX integrity, P3 = edge/operational.

## P0 — Data-Loss Bugs

- [x] **1. Cart cleared before WhatsApp confirmed**
  Added 3-step flow: cart → address → confirm. Cart only clears on explicit "Yes, I sent it."
  Confirm step also offers "Re-open WhatsApp" (anchor link) and "Copy order text" (clipboard).
  WhatsApp draft warning added for re-send scenarios.

- [x] **2. `window.open` popup-blocked in form submit**
  Replaced `window.open()` with hidden `<a>` element `.click()` — immune to popup blockers.

- [x] **3. URL truncation on large carts**
  Added `isCartUrlTooLong()` with 2,000-char ceiling. Form shows error and blocks submission
  when URL would be truncated on mobile.

## P1 — Corruption / Silent Failures

- [x] **4. Cart schema drift after deploy**
  localStorage now stores only `{sku, qty, categoryTitle, varietyName}`. Product data hydrated
  fresh from `catalog.json` via `getProductBySku()` on every load. Delisted SKUs silently dropped.
  Also added `SKU_INDEX` map in `catalog.ts` for O(1) lookups.

- [x] **5. Stale content-hashed image URLs in cart**
  Resolved by fix #4 — images always resolved from current catalog, never from stored snapshots.

- [x] **6. In-app browser localStorage isolation**
  Added `isInAppBrowser()` detector (`src/lib/webview.ts`). Cart drawer shows amber warning
  banner when inside Instagram/Facebook/TikTok/Snapchat WebViews.

## P2 — UX Integrity

- [x] **7. No cross-tab cart sync**
  Added `StorageEvent` listener in `CartContext`. Tabs re-read cart on external localStorage writes.

- [x] **8. Price drift between add and checkout**
  Resolved by fix #4 — product data (including price) hydrated fresh on every page load.

- [x] **9. Quantity inflation from dual add paths**
  Verified already correct: `ProductCard` only adds when `!inCart` (otherwise opens drawer).
  `ProductDialog` uses `updateQty` (set) for existing items, `addItem` only for new. No fix needed.

## P3 — Edge Cases & Operational

- [x] **10. WhatsApp Desktop QR login drops prefilled text**
  Confirm step includes "Copy order text" button as clipboard fallback.

- [x] **11. No order idempotency**
  Commission messages now include a pseudo order-ID (`Ref: LF-MMDD-XXXX`) based on
  timestamp hash. Studio uses Ref for deduplication.

- [x] **12. Zero operational tooling**
  Added `docs/order-operations.md`: Google Sheets schema, status values, daily workflow,
  duplicate handling, SKU transcription rules, handoff protocol, scaling triggers.

---

All 12 items addressed. The compound kill chain (large cart + popup blocked + premature clear)
is fully broken: confirmation gate prevents premature clear, anchor click prevents popup blocking,
and URL length guard prevents truncation.
