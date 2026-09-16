import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Pencil, Save, Search, Trash2, Upload, X } from 'lucide-react';
import { CANDLE_CATEGORIES } from '../../data/categories';
import type { CatalogData, StoredProduct } from '../../types/catalog';
import { formatPrice } from '../../lib/formatPrice';
import { cn } from '../../lib/utils';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { DESIGN_TOKENS } from '../../theme/designSystem';

/**
 * Local-only content panel for the product catalog.
 *
 * Adds, edits and deletes candles by talking to the dev-server middleware in
 * `scripts/catalogDevApi.ts`, which writes the photo to `src/data/catalog-images/`
 * and the metadata to `src/data/catalog.json`. Publishing is then a normal commit
 * — this replaces hand-editing a data module, not the deploy.
 *
 * ## One form, two modes
 *
 * Editing reuses the add form rather than adding a second one, because the fields
 * are identical and two forms would drift. Clicking *Edit* on a row loads that
 * product into the form and the submit button becomes **Update details**; there is
 * no separate edit screen and no modal.
 *
 * The earlier version offered only a `window.prompt` for the price, which could not
 * express the things actually needed — renaming, rewriting fragrance notes, or
 * supplying an image for a product whose file went missing.
 *
 * **Collection and variety are read-only while editing.** The SKU encodes both
 * (`BESPOKE-V1-…`) and is minted once and never recomputed, since it has already
 * been quoted in enquiries — so a move would either renumber a live product code or
 * leave a SKU that lies about where the product sits. Re-filing is delete-and-
 * re-add, which correctly issues a new code.
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

/**
 * A product plus the keys it was filed under and their display titles.
 *
 * The titles are resolved once here rather than looked up per render, because the
 * list, the search filter and the edit banner all need them.
 */
interface ListedProduct extends StoredProduct {
  categoryId: string;
  varietyId: string;
  categoryTitle: string;
  varietyName: string;
}

/** Flattens the nested catalog into one list, in collection then variety order. */
const flatten = (catalog: CatalogData): ListedProduct[] =>
  CANDLE_CATEGORIES.flatMap((category) =>
    category.subCategories.flatMap((variety) =>
      (catalog[category.id]?.[variety.id] ?? []).map((product) => ({
        ...product,
        categoryId: category.id,
        varietyId: variety.id,
        categoryTitle: category.title,
        varietyName: variety.name,
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
 * Splits the fragrance field into stored notes.
 *
 * Accepts both newlines and commas as separators. A textarea is used because real
 * notes run long — "Blush Pink — Cherry Blossom & Peony" — and four of those on one
 * comma-separated line is unreadable; commas stay supported because typing
 * "Vanilla, Cedarwood" is faster for the short case.
 *
 * The consequence, which is why this is a named function rather than an inline
 * `split`: **a note cannot itself contain a comma.** Nothing enforces that, but
 * nothing can produce one either, so the round-trip through an edit is lossless.
 */
const parseFragrance = (raw: string): string[] =>
  raw
    .split(/[\n,]/)
    .map((note) => note.trim())
    .filter(Boolean);

/** Fields the form collects, shared by the create and update paths. */
interface FormValues {
  name: string;
  priceInr: number;
  fragrance: string[];
  /** `null` when no file was chosen — meaning "keep the current photo" on an edit. */
  file: File | null;
  /**
   * Present only in add mode. While editing, the collection and variety render as
   * read-only text with no form control behind them, so there is nothing to read —
   * and nothing to send, since the SKU already identifies the product server-side.
   */
  categoryId: string | null;
  varietyId: string | null;
}

/**
 * The `/update-list` view: one form that both adds and edits, plus a searchable
 * list of what is already listed.
 */
export const UpdateListPanel: React.FC = () => {
  const formRef = useRef<HTMLFormElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const [products, setProducts] = useState<ListedProduct[]>([]);
  const [categoryId, setCategoryId] = useState(CANDLE_CATEGORIES[0].id);
  const [editing, setEditing] = useState<ListedProduct | null>(null);
  const [query, setQuery] = useState('');
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

  /** Reads the form, whichever mode it is in. */
  const readForm = (form: HTMLFormElement): FormValues => {
    const data = new FormData(form);
    const file = data.get('image');

    const readOptional = (field: string): string | null => {
      const value = data.get(field);
      return typeof value === 'string' && value !== '' ? value : null;
    };

    return {
      name: String(data.get('name') ?? '').trim(),
      priceInr: Number(data.get('priceInr')),
      fragrance: parseFragrance(String(data.get('fragrance') ?? '')),
      file: file instanceof File && file.size > 0 ? file : null,
      categoryId: readOptional('categoryId'),
      varietyId: readOptional('varietyId'),
    };
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const values = readForm(event.currentTarget);
    const target = editing;

    void run(async () => {
      if (target) {
        const response = await fetch(`/api/catalog/${encodeURIComponent(target.sku)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: values.name,
            priceInr: values.priceInr,
            fragrance: values.fragrance,
            // Only sent when a new file was chosen; the API leaves the photo alone
            // when the key is absent, so "no file" means "keep the current one".
            ...(values.file
              ? { imageBase64: await toBase64(values.file), imageFilename: values.file.name }
              : {}),
          }),
        });

        const payload = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(payload.error ?? 'Update failed.');

        setEditing(null);
        return `Updated ${target.sku}. Commit to publish.`;
      }

      if (!values.file) throw new Error('Choose an image.');

      const response = await fetch('/api/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: values.categoryId,
          varietyId: values.varietyId,
          name: values.name,
          priceInr: values.priceInr,
          fragrance: values.fragrance,
          imageBase64: await toBase64(values.file),
          imageFilename: values.file.name,
        }),
      });

      const payload = (await response.json()) as { sku?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Upload failed.');

      formRef.current?.reset();
      return `Added ${payload.sku}. Commit src/data/catalog.json and src/data/catalog-images/ to publish.`;
    });
  };

  /** Loads a product into the form and brings the form into view. */
  const handleEdit = (product: ListedProduct): void => {
    setEditing(product);
    setStatus(null);
    // The list can be long, so the form is often off-screen above; without this the
    // Edit button would look like it did nothing.
    formRef.current?.scrollIntoView({
      block: 'start',
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
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
      // A deleted product must not stay loaded in the form.
      if (editing?.sku === product.sku) setEditing(null);
      return `Deleted ${product.sku}.`;
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

  /*
   * Matched against SKU, name, notes and both titles, so the collection name finds
   * everything in it. Terms are ANDed, which makes "rose 799" behave the way a
   * two-word search is expected to.
   */
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const visible = products.filter((product) => {
    if (terms.length === 0) return true;
    const haystack = [
      product.sku,
      product.name,
      product.categoryTitle,
      product.varietyName,
      String(product.priceInr),
      ...product.fragrance,
    ]
      .join(' ')
      .toLowerCase();

    return terms.every((term) => haystack.includes(term));
  });

  const fieldClasses =
    'w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm font-light text-stone-900 outline-none focus-visible:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-500/40 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100';
  const labelClasses =
    'block space-y-1.5 text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-400';
  const readOnlyClasses =
    'w-full rounded-xl border border-dashed border-stone-300 bg-stone-100 px-3.5 py-2.5 text-sm font-light text-stone-500 dark:border-stone-700 dark:bg-stone-900/60 dark:text-stone-400';
  const rowButtonClasses =
    'rounded-full border border-stone-300 px-3 py-1 text-xs uppercase tracking-wider text-stone-700 transition-colors hover:border-amber-500 disabled:opacity-50 dark:border-stone-700 dark:text-stone-300';

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

      <section aria-labelledby="form-heading" className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2
            id="form-heading"
            className="text-2xl font-light tracking-tight text-stone-900 dark:text-stone-100"
          >
            {editing ? `Editing ${editing.sku}` : 'Add a candle'}
          </h2>

          {editing && (
            <button
              type="button"
              onClick={() => setEditing(null)}
              className={cn(rowButtonClasses, 'inline-flex items-center gap-1.5')}
            >
              <X className="h-3 w-3" aria-hidden="true" />
              Cancel edit
            </button>
          )}
        </div>

        {/*
          `key` remounts the form when the mode changes, which is what lets every
          field use `defaultValue` instead of being individually controlled — React
          re-reads the defaults on a fresh mount. Without it, switching from one
          product to another would keep the first one's values on screen.
        */}
        <form
          key={editing?.sku ?? 'new'}
          ref={formRef}
          onSubmit={handleSubmit}
          className="grid gap-5 sm:grid-cols-2"
        >
          {editing ? (
            <>
              <div className={labelClasses}>
                <span>Collection</span>
                <p className={readOnlyClasses}>{editing.categoryTitle}</p>
              </div>
              <div className={labelClasses}>
                <span>Variety</span>
                <p className={readOnlyClasses}>{editing.varietyName}</p>
              </div>
              <p className="text-xs font-light normal-case tracking-normal text-stone-500 sm:col-span-2 dark:text-stone-400">
                Filing can&apos;t be changed here — the SKU encodes it and SKUs are never reissued.
                To move this candle, delete it and add it again.
              </p>
            </>
          ) : (
            <>
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
            </>
          )}

          <label className={labelClasses}>
            <span>Name</span>
            <input
              name="name"
              required
              defaultValue={editing?.name}
              placeholder="Amber Glow Jar"
              className={fieldClasses}
            />
          </label>

          <label className={labelClasses}>
            <span>Price (₹)</span>
            <input
              name="priceInr"
              type="number"
              min="1"
              step="1"
              required
              defaultValue={editing?.priceInr}
              placeholder="1200"
              className={fieldClasses}
            />
          </label>

          <label className={cn(labelClasses, 'sm:col-span-2')}>
            <span>Fragrance notes</span>
            <textarea
              name="fragrance"
              /* Five, not three: real listings carry four notes and a shorter box
                 clipped the last one out of sight while editing it. */
              rows={5}
              defaultValue={editing?.fragrance.join('\n')}
              placeholder={'One note per line, or comma-separated:\nVanilla, Cedarwood'}
              className={cn(fieldClasses, 'resize-y')}
            />
          </label>

          <label className={labelClasses}>
            <span>{editing ? 'Replace photo' : 'Photo'}</span>
            <input
              name="image"
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.avif"
              // Required only when creating: an edit that leaves this empty keeps
              // the existing photo.
              required={!editing}
              className={cn(
                fieldClasses,
                'file:mr-3 file:border-0 file:bg-transparent file:text-xs'
              )}
            />
          </label>

          {editing && (
            <p className="self-end text-xs font-light normal-case tracking-normal text-stone-500 dark:text-stone-400">
              Currently <span className="font-normal">{editing.image}</span>. Leave empty to keep
              it.
            </p>
          )}

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
              ) : editing ? (
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {editing ? 'Update details' : 'Add candle'}
            </button>
          </div>
        </form>
      </section>

      <section aria-labelledby="listed" className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2
            id="listed"
            className="text-2xl font-light tracking-tight text-stone-900 dark:text-stone-100"
          >
            Listed{' '}
            <span className="text-base text-stone-500 tabular-nums dark:text-stone-400">
              ({terms.length > 0 ? `${visible.length} of ${products.length}` : products.length})
            </span>
          </h2>

          <div className="relative w-full sm:w-72">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search listed candles"
              placeholder="Search name, SKU, collection…"
              className={cn(fieldClasses, 'pl-9')}
            />
          </div>
        </div>

        {products.length === 0 ? (
          <p className={cn(DESIGN_TOKENS.typography.body, 'text-stone-600 dark:text-stone-400')}>
            Nothing listed yet. Every variety renders without a product rail until it has one.
          </p>
        ) : visible.length === 0 ? (
          <p className={cn(DESIGN_TOKENS.typography.body, 'text-stone-600 dark:text-stone-400')}>
            No candle matches “{query}”.
          </p>
        ) : (
          <ul className="divide-y divide-stone-200 dark:divide-stone-800">
            {visible.map((product) => (
              <li
                key={product.sku}
                className={cn(
                  'flex flex-wrap items-center gap-x-4 gap-y-2 py-4 text-sm font-light',
                  // Marks which row the form is currently holding, so a scrolled-away
                  // form doesn't leave you guessing what you're editing.
                  editing?.sku === product.sku && 'bg-amber-500/5'
                )}
              >
                <span className="w-36 shrink-0 text-xs tabular-nums text-stone-500 dark:text-stone-400">
                  {product.sku}
                </span>

                <span className="min-w-40 flex-1 space-y-0.5">
                  <span className="block text-stone-900 dark:text-stone-100">{product.name}</span>
                  <span className="block text-xs text-stone-500 dark:text-stone-400">
                    {product.categoryTitle} › {product.varietyName}
                  </span>
                </span>

                <span className="tabular-nums text-stone-700 dark:text-stone-300">
                  {formatPrice(product.priceInr)}
                </span>

                <button
                  type="button"
                  onClick={() => handleEdit(product)}
                  disabled={busy}
                  aria-label={`Edit ${product.sku}`}
                  className={cn(rowButtonClasses, 'inline-flex items-center gap-1.5')}
                >
                  <Pencil className="h-3 w-3" aria-hidden="true" />
                  Edit
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(product)}
                  disabled={busy}
                  aria-label={`Delete ${product.sku}`}
                  className="rounded-full border border-stone-300 p-1.5 text-stone-600 transition-colors hover:border-red-500 hover:text-red-600 disabled:opacity-50 dark:border-stone-700 dark:text-stone-400"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
