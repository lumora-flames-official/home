import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Trash2, Upload } from 'lucide-react';
import { CANDLE_CATEGORIES } from '../../data/categories';
import type { CatalogData, StoredProduct } from '../../types/catalog';
import { formatPrice } from '../../lib/formatPrice';
import { cn } from '../../lib/utils';
import { DESIGN_TOKENS } from '../../theme/designSystem';

/**
 * Local-only content panel for the product catalog.
 *
 * Adds, re-prices and deletes candles by talking to the dev-server middleware in
 * `scripts/catalogDevApi.ts`, which writes the photo to `src/data/catalog-images/`
 * and the metadata to `src/data/catalog.json`. Publishing is then a normal commit
 * — this replaces hand-editing a data module, not the deploy.
 *
 * ## Why there are two guards, and which one actually matters
 *
 * `App.tsx` only registers this route when `import.meta.env.DEV` is true. Vite
 * replaces that with the literal `false` in a production build, so the branch and
 * its dynamic import are dead code and the panel is **not in the bundle** —
 * that is the guard doing the real work.
 *
 * The hostname check below is the second layer, and it is worth being precise
 * about what it is for. It cannot protect anything on its own: a check performed
 * by code that shipped is a check an attacker can read and skip. What it does
 * catch is the honest mistake — a preview build made with `--mode development`, or
 * someone serving `dist/` from a tunnel — where the panel would otherwise render a
 * form whose API does not exist and fail with a confusing network error rather
 * than a clear "not available here".
 *
 * Neither guard is a substitute for the fact that the API itself only exists while
 * `vite serve` is running.
 */

/** Hosts where a dev server can plausibly be running. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

const isLocalHost = (): boolean => LOCAL_HOSTS.has(window.location.hostname);

/** A product plus the keys it was filed under, flattened for the listing table. */
interface ListedProduct extends StoredProduct {
  categoryId: string;
  varietyId: string;
}

/** Flattens the nested catalog into one list, in category then variety order. */
const flatten = (catalog: CatalogData): ListedProduct[] =>
  CANDLE_CATEGORIES.flatMap((category) =>
    category.subCategories.flatMap((variety) =>
      (catalog[category.id]?.[variety.id] ?? []).map((product) => ({
        ...product,
        categoryId: category.id,
        varietyId: variety.id,
      }))
    )
  );

/** Reads a `File` as a base64 data URL, which is what the API expects. */
const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });

/**
 * The `/update-list` view: upload form plus a table of what is already listed.
 */
export const UpdateListPanel: React.FC = () => {
  const formRef = useRef<HTMLFormElement>(null);
  const [products, setProducts] = useState<ListedProduct[]>([]);
  const [categoryId, setCategoryId] = useState(CANDLE_CATEGORIES[0].id);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; message: string } | null>(null);

  /**
   * Varieties for the chosen collection, driven from `CANDLE_CATEGORIES` rather
   * than typed in. This is what makes it impossible to save an id that
   * `assertCatalogResolves` would later reject — the form cannot express one.
   */
  const varieties =
    CANDLE_CATEGORIES.find((candidate) => candidate.id === categoryId)?.subCategories ?? [];

  /**
   * Reads the current catalog. Deliberately free of `setState` so it can be shared
   * by the mount effect and the post-write refresh without either of them
   * inheriting the other's state handling.
   */
  const fetchCatalog = async (): Promise<ListedProduct[]> => {
    const response = await fetch('/api/catalog');
    if (!response.ok) throw new Error('Could not read the catalog. Is `npm run dev` running?');
    return flatten((await response.json()) as CatalogData);
  };

  /**
   * Loads the listing once on mount.
   *
   * The `cancelled` flag is the same guard the project uses around dynamic GSAP
   * imports: a fetch that resolves after unmount would otherwise set state on a
   * gone component. Navigating away from this page mid-load is easy to do.
   */
  useEffect(() => {
    if (!isLocalHost()) return;

    let cancelled = false;

    void (async () => {
      try {
        const listed = await fetchCatalog();
        if (!cancelled) setProducts(listed);
      } catch (error) {
        if (!cancelled) setStatus({ tone: 'error', message: (error as Error).message });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /** Runs an API call with shared busy/status handling, then reloads the listing. */
  const run = async (action: () => Promise<string>): Promise<void> => {
    setBusy(true);
    setStatus(null);
    try {
      const message = await action();
      setProducts(await fetchCatalog());
      setStatus({ tone: 'ok', message });
    } catch (error) {
      setStatus({ tone: 'error', message: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get('image');

    void run(async () => {
      if (!(file instanceof File) || file.size === 0) throw new Error('Choose an image.');

      const response = await fetch('/api/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: form.get('categoryId'),
          varietyId: form.get('varietyId'),
          name: form.get('name'),
          priceInr: Number(form.get('priceInr')),
          // Comma-separated in the form because typing chips is slower than typing
          // a list; split here so the stored shape is the array the cards render.
          fragrance: String(form.get('fragrance') ?? '')
            .split(',')
            .map((note) => note.trim())
            .filter(Boolean),
          imageBase64: await toBase64(file),
          imageFilename: file.name,
        }),
      });

      const payload = (await response.json()) as { sku?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Upload failed.');

      formRef.current?.reset();
      return `Added ${payload.sku}. Commit src/data/catalog.json and src/data/catalog-images/ to publish.`;
    });
  };

  const handleDelete = (product: ListedProduct): void => {
    if (!window.confirm(`Delete ${product.sku} — ${product.name}? This removes its photo too.`)) {
      return;
    }

    void run(async () => {
      const response = await fetch(`/api/catalog/${encodeURIComponent(product.sku)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(((await response.json()) as { error?: string }).error ?? 'Delete failed.');
      }
      return `Deleted ${product.sku}.`;
    });
  };

  const handleReprice = (product: ListedProduct): void => {
    const entered = window.prompt(
      `New price in rupees for ${product.sku}:`,
      String(product.priceInr)
    );
    if (entered === null) return;

    void run(async () => {
      const response = await fetch(`/api/catalog/${encodeURIComponent(product.sku)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceInr: Number(entered) }),
      });
      if (!response.ok) {
        throw new Error(((await response.json()) as { error?: string }).error ?? 'Update failed.');
      }
      return `Updated ${product.sku}.`;
    });
  };

  if (!isLocalHost()) {
    return (
      <section className="mx-auto max-w-xl py-24 text-center">
        <h1
          className={cn(
            DESIGN_TOKENS.typography.sectionTitle,
            'text-stone-900 dark:text-stone-100'
          )}
        >
          Not found
        </h1>
        <p className={cn(DESIGN_TOKENS.typography.body, 'mt-4 text-stone-600 dark:text-stone-400')}>
          This page only exists on a local development server.
        </p>
      </section>
    );
  }

  const fieldClasses =
    'w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm font-light text-stone-900 outline-none focus-visible:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-500/40 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100';
  const labelClasses =
    'block space-y-1.5 text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-400';

  return (
    <div className="space-y-14 pb-24">
      <header className="space-y-2">
        <span className={DESIGN_TOKENS.typography.eyebrow}>Local only · not deployed</span>
        <h1
          className={cn(
            DESIGN_TOKENS.typography.sectionTitle,
            'text-stone-900 dark:text-stone-100'
          )}
        >
          Catalog
        </h1>
        <p
          className={cn(
            DESIGN_TOKENS.typography.body,
            'max-w-2xl text-stone-600 dark:text-stone-400'
          )}
        >
          Writes straight to the repository. Changes appear on the site once you commit and push —
          nothing here reaches a live visitor on its own.
        </p>
      </header>

      {status && (
        <p
          role="status"
          className={cn(
            'rounded-xl border px-4 py-3 text-sm font-light',
            status.tone === 'ok'
              ? 'border-amber-500/40 bg-amber-500/10 text-stone-800 dark:text-stone-200'
              : 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300'
          )}
        >
          {status.message}
        </p>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="grid gap-5 sm:grid-cols-2">
        <label className={labelClasses}>
          <span>Collection</span>
          <select
            name="categoryId"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className={fieldClasses}
          >
            {CANDLE_CATEGORIES.map((category) => (
              <option key={category.id} value={category.id}>
                {category.title}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClasses}>
          <span>Variety</span>
          {/* Keyed on the collection so switching resets the selection to that
              collection's first variety instead of keeping a stale index. */}
          <select key={categoryId} name="varietyId" className={fieldClasses}>
            {varieties.map((variety) => (
              <option key={variety.id} value={variety.id}>
                {variety.name}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClasses}>
          <span>Name</span>
          <input name="name" required placeholder="Amber Glow Jar" className={fieldClasses} />
        </label>

        <label className={labelClasses}>
          <span>Price (₹)</span>
          <input
            name="priceInr"
            type="number"
            min="1"
            step="1"
            required
            placeholder="1200"
            className={fieldClasses}
          />
        </label>

        <label className={labelClasses}>
          <span>Fragrance notes</span>
          <input name="fragrance" placeholder="Vanilla, Cedarwood" className={fieldClasses} />
        </label>

        <label className={labelClasses}>
          <span>Photo</span>
          <input
            name="image"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.avif"
            required
            className={cn(fieldClasses, 'file:mr-3 file:border-0 file:bg-transparent file:text-xs')}
          />
        </label>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={busy}
            className={cn(
              'inline-flex items-center gap-2.5 rounded-full bg-amber-500 px-7 py-3.5 text-stone-950 transition-colors hover:bg-amber-400 disabled:opacity-50',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-50 dark:focus-visible:ring-offset-stone-950',
              DESIGN_TOKENS.typography.button
            )}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Add candle
          </button>
        </div>
      </form>

      <section aria-labelledby="listed" className="space-y-5">
        <h2
          id="listed"
          className="text-2xl font-light tracking-tight text-stone-900 dark:text-stone-100"
        >
          Listed ({products.length})
        </h2>

        {products.length === 0 ? (
          <p className={cn(DESIGN_TOKENS.typography.body, 'text-stone-600 dark:text-stone-400')}>
            Nothing listed yet. Every variety renders without a product rail until it has one.
          </p>
        ) : (
          <ul className="divide-y divide-stone-200 dark:divide-stone-800">
            {products.map((product) => (
              <li
                key={product.sku}
                className="flex flex-wrap items-center gap-4 py-4 text-sm font-light"
              >
                <span className="w-36 shrink-0 text-xs tabular-nums text-stone-500 dark:text-stone-400">
                  {product.sku}
                </span>
                <span className="min-w-40 flex-1 text-stone-900 dark:text-stone-100">
                  {product.name}
                </span>
                <span className="tabular-nums text-stone-700 dark:text-stone-300">
                  {formatPrice(product.priceInr)}
                </span>
                <button
                  type="button"
                  onClick={() => handleReprice(product)}
                  disabled={busy}
                  className="rounded-full border border-stone-300 px-3 py-1 text-xs uppercase tracking-wider text-stone-700 transition-colors hover:border-amber-500 disabled:opacity-50 dark:border-stone-700 dark:text-stone-300"
                >
                  Reprice
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(product)}
                  disabled={busy}
                  aria-label={`Delete ${product.sku}`}
                  className="rounded-full border border-stone-300 p-1.5 text-stone-600 transition-colors hover:border-red-500 hover:text-red-600 disabled:opacity-50 dark:border-stone-700 dark:text-stone-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
