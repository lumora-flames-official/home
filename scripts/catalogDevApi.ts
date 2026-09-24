import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin, ViteDevServer } from 'vite';

/**
 * Dev-server API behind the local-only CMS at `/update-list`.
 *
 * This is the write half of the publishing story: the panel posts a candle, this
 * writes the photo into `src/data/catalog-images/` and appends the metadata to
 * `src/data/catalog.json`, and publishing is then an ordinary `git commit`. The
 * site stays a static build with no backend and no runtime fetch — the "server"
 * exists only on the maintainer's laptop, and only while `npm run dev` is running.
 *
 * ## Why `apply: 'serve'` is load-bearing
 *
 * It is not an optimisation. These handlers write to the repository, so the
 * guarantee that matters is that they *cannot* exist in a built artifact. Vite
 * only instantiates the plugin for the dev server, so `vite build` never sees
 * these handlers at all. The panel that calls them is separately gated on
 * `import.meta.env.DEV` in `App.tsx`, so neither half ships.
 *
 * ## Why JSON + base64 rather than `multipart/form-data`
 *
 * Node has no built-in multipart parser, so the options were hand-rolling one
 * (fiddly, and a parser bug here corrupts the repo) or adding `busboy` for a
 * localhost-only code path. Base64 inflates the payload by a third, which over
 * loopback for one photo is not a cost worth a dependency. The endpoint contract
 * is internal, so nothing user-facing depends on the choice.
 */

/** Repo root, derived from this file's location so the plugin is not cwd-sensitive. */
const ROOT = path.resolve(import.meta.dirname, '..');
const CATALOG_FILE = path.join(ROOT, 'src', 'data', 'catalog.json');
const IMAGES_ROOT = path.join(ROOT, 'src', 'data', 'catalog-images');

/**
 * Extensions accepted for upload.
 *
 * Must stay in step with the glob pattern in `src/data/catalogImages.ts`: a file
 * written here with an extension that glob does not match is invisible to the
 * site, and `assertCatalogResolves` would then throw on a product whose image is
 * sitting right there on disk.
 */
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

/**
 * 60 MB. Source photography is 2–3 MB and base64 inflates by a third, so a full
 * six-shot gallery lands near 24 MB — the previous 25 MB ceiling would have rejected
 * it outright. Generous, but still a ceiling: unbounded is not.
 */
const MAX_BODY_BYTES = 60 * 1024 * 1024;

/**
 * Photos accepted per product.
 *
 * A limit rather than none, because every image is committed to the repository and
 * a stray select-all in a photo library is one keystroke.
 */
const MAX_IMAGES = 6;

/** Minimal shape of a stored product, mirroring `src/types/catalog.ts`. */
interface StoredProduct {
  sku: string;
  name: string;
  priceInr: number;
  fragrance: string[];
  image: string;
  images?: string[];
}

type CatalogData = Record<string, Record<string, StoredProduct[]>>;

/**
 * Thrown for anything the client got wrong, so handlers can stay linear and the
 * single catch in the middleware turns it into the right status code.
 *
 * `status` is assigned in the body rather than declared as a constructor parameter
 * property, because `erasableSyntaxOnly` is on — a parameter property emits real
 * code, so it isn't erasable type syntax.
 */
class RequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/* ------------------------------------------------------------------ *
 * Plumbing
 * ------------------------------------------------------------------ */

const sendJson = (res: ServerResponse, status: number, body: unknown): void => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};

/** Reads and parses a JSON request body, refusing anything oversized. */
const readJsonBody = async (req: IncomingMessage): Promise<Record<string, unknown>> => {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) {
      throw new RequestError(413, `Body exceeds ${MAX_BODY_BYTES / 1024 / 1024} MB.`);
    }
    chunks.push(chunk as Buffer);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
  } catch {
    throw new RequestError(400, 'Body is not valid JSON.');
  }
};

const readCatalog = async (): Promise<CatalogData> => {
  try {
    return JSON.parse(await readFile(CATALOG_FILE, 'utf8')) as CatalogData;
  } catch (error) {
    // A missing file is a legitimate empty catalog; malformed JSON is not, and
    // silently replacing it with `{}` would delete the whole listing.
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw new RequestError(500, `src/data/catalog.json is not valid JSON — fix it by hand.`);
  }
};

/**
 * Writes the catalog back to disk, formatted by Prettier itself.
 *
 * This has to be exact, not merely tidy. `npm run format:check` gates both deploy
 * workflows and `.prettierignore` does not cover this file, so a badly formatted
 * write fails CI on the *next* push — by which point the red check looks unrelated
 * to having added a product.
 *
 * `JSON.stringify(data, null, 2)` is not sufficient and was tried first: Prettier
 * collapses a short array onto one line, so a two-note `fragrance` array came back
 * as a formatting violation the moment the first product was saved. Rather than
 * re-implementing Prettier's line-fitting heuristics here — a second definition of
 * the project's formatting, guaranteed to drift — this asks Prettier, resolving
 * `.prettierrc.json` through `resolveConfig` so there is still exactly one source
 * of truth for style.
 *
 * Imported dynamically so `vite build` never loads Prettier just to read the config
 * file that imports this plugin.
 */
const writeCatalog = async (data: CatalogData): Promise<void> => {
  const { format, resolveConfig } = await import('prettier');
  const options = await resolveConfig(CATALOG_FILE);

  const formatted = await format(JSON.stringify(data), {
    ...options,
    filepath: CATALOG_FILE,
  });

  await writeFile(CATALOG_FILE, formatted, 'utf8');
};

/* ------------------------------------------------------------------ *
 * Validation
 * ------------------------------------------------------------------ */

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Loads the canonical category tree and the SKU helpers through Vite.
 *
 * `ssrLoadModule` rather than a plain `import`, because `src/data/categories.ts`
 * imports `assets.ts`, which imports `.png`/`.svg` files — Node cannot load those,
 * but Vite's transform resolves them to URL strings. This is the difference
 * between validating against the real `CANDLE_CATEGORIES` and keeping a
 * hand-copied id list in this file, which is exactly the "two constants that must
 * match will eventually not match" failure the project's DRY rule calls out.
 */
const loadProjectModules = async (server: ViteDevServer) => {
  const [categories, sku] = await Promise.all([
    server.ssrLoadModule('/src/data/categories.ts'),
    server.ssrLoadModule('/src/lib/sku.ts'),
  ]);

  return {
    categories: categories.CANDLE_CATEGORIES as {
      id: string;
      subCategories: { id: string }[];
    }[],
    buildSku: sku.buildSku as (categoryId: string, varietyIndex: number, seq: number) => string,
    nextSkuSequence: sku.nextSkuSequence as (skus: readonly string[]) => number,
  };
};

/** Reads a required string field, rejecting blanks rather than storing them. */
const requireString = (body: Record<string, unknown>, field: string): string => {
  const value = body[field];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new RequestError(400, `"${field}" is required.`);
  }
  return value.trim();
};

/** Reads a price, rejecting negatives, zero and non-integers. */
const requirePrice = (body: Record<string, unknown>): number => {
  const value = Number(body.priceInr);
  if (!Number.isInteger(value) || value <= 0) {
    throw new RequestError(400, '"priceInr" must be a whole number of rupees above zero.');
  }
  return value;
};

const readFragrance = (body: Record<string, unknown>): string[] =>
  Array.isArray(body.fragrance)
    ? body.fragrance.map((note) => String(note).trim()).filter(Boolean)
    : [];

/**
 * Resolves the on-disk path for a product photo, refusing to escape the images
 * directory.
 *
 * Local-only is not a reason to skip this. `categoryId` becomes a directory name
 * and the filename comes from a file picker, so a `..` in either would write
 * outside `catalog-images/` — into the source tree, silently, in a repo that is
 * about to be committed. The slug check and the containment check are belt and
 * braces because the first is easy to loosen later without noticing the second
 * was relying on it.
 */
const resolveImagePath = (categoryId: string, filename: string): string => {
  if (!/^[a-z0-9-]+$/.test(categoryId)) {
    throw new RequestError(400, `"${categoryId}" is not a valid collection id.`);
  }

  const resolved = path.resolve(IMAGES_ROOT, categoryId, path.basename(filename));
  if (!resolved.startsWith(IMAGES_ROOT + path.sep)) {
    throw new RequestError(400, 'Resolved image path escapes the catalog images directory.');
  }

  return resolved;
};

/**
 * Every filename already used under a collection, across all of its varieties.
 *
 * @param keep Filenames the caller is allowed to overwrite — the editing product's
 *   own images. Without this, replacing a photo without renaming the product would
 *   see its own file as taken and write `amber-glow-2.jpg`, orphaning the original
 *   and growing a suffix on every subsequent replacement.
 */
const takenFilenames = (
  catalog: CatalogData,
  categoryId: string,
  keep: readonly string[] = []
): Set<string> => {
  const taken = new Set(
    Object.values(catalog[categoryId] ?? {}).flatMap((list) =>
      list.flatMap((p) => [p.image, ...(p.images ?? [])])
    )
  );
  for (const filename of keep) taken.delete(filename);
  return taken;
};

/**
 * Chooses a collision-free filename for a product photo and marks it as used.
 *
 * Named after the product so `catalog-images/` is readable in a diff, and suffixed
 * rather than overwritten on collision — two candles can legitimately share a name,
 * and losing the earlier photo would be silent.
 *
 * `taken` is **mutated**, which is the point: a multi-image upload calls this once
 * per file and every call has to see the names the previous ones just claimed. A
 * version that rebuilt the set from the catalog each time would hand all six shots
 * of one candle the same filename and write each over the last.
 */
const pickImageFilename = (
  taken: Set<string>,
  name: string,
  extension: string,
  index: number
): string => {
  // Extras carry a `-2`, `-3` … suffix from the start, so a gallery reads in order
  // on disk instead of depending on collision order to number itself.
  const base = `${slugify(name) || 'product'}${index === 0 ? '' : `-${index + 1}`}`;

  let filename = `${base}${extension}`;
  for (let suffix = 2; taken.has(filename); suffix += 1) {
    filename = `${base}-${suffix}${extension}`;
  }

  taken.add(filename);
  return filename;
};

/**
 * Decodes the uploaded photos and validates their extensions.
 *
 * Expects `images: [{ base64, filename }]`, cover first. One array rather than a
 * cover field plus an extras field: the panel's file input hands over the whole
 * selection at once, so a split here would only exist to be reassembled.
 *
 * @returns The decoded files in order, or `null` when the key is absent — which an
 *   update reads as "leave the photos alone".
 */
const decodeUploads = (
  body: Record<string, unknown>
): { bytes: Buffer; extension: string }[] | null => {
  if (body.images === undefined) return null;

  if (!Array.isArray(body.images) || body.images.length === 0) {
    throw new RequestError(400, '"images" must be a non-empty array.');
  }
  if (body.images.length > MAX_IMAGES) {
    throw new RequestError(400, `At most ${MAX_IMAGES} photos per product.`);
  }

  return body.images.map((entry, index) => {
    const upload = (entry ?? {}) as Record<string, unknown>;
    const base64 = requireString(upload, 'base64');
    const extension = path.extname(requireString(upload, 'filename')).toLowerCase();

    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throw new RequestError(
        400,
        `"${extension}" images aren't supported. Use one of: ${[...ALLOWED_EXTENSIONS].join(', ')}.`
      );
    }

    const bytes = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ''), 'base64');
    if (bytes.length === 0) throw new RequestError(400, `Photo ${index + 1} decoded to nothing.`);

    return { bytes, extension };
  });
};

/**
 * Writes a product's photos to disk and returns their filenames, cover first.
 *
 * Files land before `catalog.json` is touched, for the reason spelled out on
 * {@link updateProduct}: an entry pointing at a file that is not there yet makes
 * `assertCatalogResolves` throw on every page load.
 */
const writeUploads = async (
  uploads: { bytes: Buffer; extension: string }[],
  taken: Set<string>,
  categoryId: string,
  name: string
): Promise<string[]> => {
  const filenames = uploads.map((upload, index) =>
    pickImageFilename(taken, name, upload.extension, index)
  );

  await mkdir(path.join(IMAGES_ROOT, categoryId), { recursive: true });
  await Promise.all(
    filenames.map((filename, index) =>
      writeFile(resolveImagePath(categoryId, filename), uploads[index].bytes)
    )
  );

  return filenames;
};

/**
 * Deletes a file, tolerating one that is already gone.
 *
 * Missing is an acceptable outcome for both callers: a delete is finishing the job,
 * and an update is superseding a photo that `assertCatalogResolves` may already be
 * complaining about. Any *other* error still throws — a permissions problem should
 * not be swallowed.
 */
const unlinkIfPresent = async (target: string): Promise<void> => {
  try {
    await unlink(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
};

/* ------------------------------------------------------------------ *
 * Handlers
 * ------------------------------------------------------------------ */

/** `POST /api/catalog` — writes the photo, appends the entry, returns the new SKU. */
const createProduct = async (
  server: ViteDevServer,
  body: Record<string, unknown>
): Promise<StoredProduct & { categoryId: string; varietyId: string }> => {
  const { categories, buildSku, nextSkuSequence } = await loadProjectModules(server);

  const categoryId = requireString(body, 'categoryId');
  const varietyId = requireString(body, 'varietyId');
  const name = requireString(body, 'name');
  const priceInr = requirePrice(body);
  const fragrance = readFragrance(body);

  const category = categories.find((candidate) => candidate.id === categoryId);
  if (!category) throw new RequestError(400, `Unknown collection "${categoryId}".`);

  const varietyIndex = category.subCategories.findIndex((v) => v.id === varietyId);
  if (varietyIndex === -1) {
    throw new RequestError(400, `Collection "${categoryId}" has no variety "${varietyId}".`);
  }

  const uploads = decodeUploads(body);
  if (!uploads) throw new RequestError(400, 'At least one photo is required.');

  const catalog = await readCatalog();
  const variety = catalog[categoryId]?.[varietyId] ?? [];

  const [cover, ...extras] = await writeUploads(
    uploads,
    takenFilenames(catalog, categoryId),
    categoryId,
    name
  );

  const product: StoredProduct = {
    sku: buildSku(categoryId, varietyIndex, nextSkuSequence(variety.map((p) => p.sku))),
    name,
    priceInr,
    fragrance,
    image: cover,
    // Omitted rather than written as `[]` when there is only a cover, so a
    // single-photo record is byte-identical to one written before galleries existed.
    ...(extras.length > 0 ? { images: extras } : {}),
  };

  catalog[categoryId] ??= {};
  catalog[categoryId][varietyId] = [...variety, product];
  await writeCatalog(catalog);

  return { ...product, categoryId, varietyId };
};

/** Finds a product by SKU, returning its position so callers can edit in place. */
const locate = (
  catalog: CatalogData,
  sku: string
): { categoryId: string; varietyId: string; index: number } => {
  for (const [categoryId, varieties] of Object.entries(catalog)) {
    for (const [varietyId, products] of Object.entries(varieties)) {
      const index = products.findIndex((product) => product.sku === sku);
      if (index !== -1) return { categoryId, varietyId, index };
    }
  }
  throw new RequestError(404, `No product with SKU "${sku}".`);
};

/**
 * `PUT /api/catalog/:sku` — updates name, price, fragrance and/or the photo.
 *
 * Every field is optional and an omitted one is left alone, so a caller can send a
 * single changed value without having to echo the rest back correctly.
 *
 * **What is deliberately not editable, and why:** the SKU, and the collection and
 * variety the product is filed under. The SKU encodes both (`BESPOKE-V1-…`) and is
 * minted once and never recomputed, because it has already been quoted in WhatsApp
 * enquiries. Allowing a move would therefore either renumber a live product code or
 * leave a SKU that lies about where the product sits. Re-filing a candle is
 * delete-and-re-add, which correctly gives it a new code.
 *
 * The stored filename is *not* renamed when only the name changes. It would be
 * churn in git history for no gain — the filename is never shown to a visitor, and
 * a rename means a delete plus a write where nothing about the image changed.
 *
 * **Photos are replaced as a set, not merged.** Sending `images` supersedes the whole
 * gallery; omitting it keeps every existing shot. There is no "append one" or "remove
 * the third" operation, because the panel's file input hands over a complete selection
 * anyway — per-image editing would need stable ids for files whose only identity is
 * their position.
 */
const updateProduct = async (
  sku: string,
  body: Record<string, unknown>
): Promise<StoredProduct> => {
  const catalog = await readCatalog();
  const { categoryId, varietyId, index } = locate(catalog, sku);
  const existing = catalog[categoryId][varietyId][index];
  const existingFilenames = [existing.image, ...(existing.images ?? [])];

  const name = body.name === undefined ? existing.name : requireString(body, 'name');

  const uploads = decodeUploads(body);
  let filenames = existingFilenames;

  if (uploads) {
    // The product's own filenames are passed as `keep`, so replacing photos without
    // renaming the product reuses them instead of suffixing itself to `-2`.
    filenames = await writeUploads(
      uploads,
      takenFilenames(catalog, categoryId, existingFilenames),
      categoryId,
      name
    );
  }

  const [cover, ...extras] = filenames;

  const updated: StoredProduct = {
    ...existing,
    name,
    priceInr: body.priceInr === undefined ? existing.priceInr : requirePrice(body),
    fragrance: body.fragrance === undefined ? existing.fragrance : readFragrance(body),
    image: cover,
    ...(extras.length > 0 ? { images: extras } : {}),
  };
  if (extras.length === 0) delete updated.images;

  catalog[categoryId][varietyId][index] = updated;
  await writeCatalog(catalog);

  /*
   * Ordering is load-bearing: new files, then JSON, then remove the old ones.
   *
   * Any interruption then leaves `catalog.json` pointing at files that exist.
   * Deleting first would open a window where a crash strands an entry whose image
   * is gone, which makes `assertCatalogResolves` throw on every page load — the app
   * would not boot, and the only way back is editing JSON by hand.
   */
  const kept = new Set(filenames);
  for (const superseded of existingFilenames) {
    if (!kept.has(superseded)) await unlinkIfPresent(resolveImagePath(categoryId, superseded));
  }

  return updated;
};

/** `DELETE /api/catalog/:sku` — removes the entry and its photo. */
const deleteProduct = async (sku: string): Promise<void> => {
  const catalog = await readCatalog();
  const { categoryId, varietyId, index } = locate(catalog, sku);
  const [removed] = catalog[categoryId][varietyId].splice(index, 1);

  // Prune emptied containers, so `catalog.json` doesn't accumulate hollow keys
  // that read as "this variety has a listing" to anyone scanning the file.
  if (catalog[categoryId][varietyId].length === 0) delete catalog[categoryId][varietyId];
  if (Object.keys(catalog[categoryId]).length === 0) delete catalog[categoryId];

  await writeCatalog(catalog);

  // Metadata first, for the same reason as the update above: an orphaned image is
  // harmless clutter, whereas an orphaned *entry* whose image is gone makes the
  // dev-time assertion throw on every page load.
  for (const filename of [removed.image, ...(removed.images ?? [])]) {
    await unlinkIfPresent(resolveImagePath(categoryId, filename));
  }
};

/* ------------------------------------------------------------------ *
 * Plugin
 * ------------------------------------------------------------------ */

/**
 * Mounts the catalog write API on the Vite dev server.
 *
 * @returns A Vite plugin that is inert outside `vite serve`.
 */
export const catalogDevApi = (): Plugin => ({
  name: 'lumora:catalog-dev-api',
  // See the module comment: this is a safety boundary, not a performance tweak.
  apply: 'serve',

  configureServer(server) {
    server.middlewares.use('/api/catalog', (req, res, next) => {
      // Vite strips the mount path, so `/api/catalog/BESPOKE-V1-01` arrives as
      // `/BESPOKE-V1-01` and the collection endpoint arrives as `/`.
      const sku = decodeURIComponent((req.url ?? '/').split('?')[0].replace(/^\//, ''));

      void (async () => {
        try {
          switch (req.method) {
            case 'GET':
              sendJson(res, 200, await readCatalog());
              return;

            case 'POST':
              sendJson(res, 201, await createProduct(server, await readJsonBody(req)));
              return;

            case 'PUT':
              if (!sku) throw new RequestError(400, 'PUT requires a SKU in the path.');
              sendJson(res, 200, await updateProduct(sku, await readJsonBody(req)));
              return;

            case 'DELETE':
              if (!sku) throw new RequestError(400, 'DELETE requires a SKU in the path.');
              await deleteProduct(sku);
              sendJson(res, 200, { sku });
              return;

            default:
              next();
          }
        } catch (error) {
          const status = error instanceof RequestError ? error.status : 500;
          const message = error instanceof Error ? error.message : 'Unknown error.';

          // Logged as well as returned: the panel shows the message, but a 500 here
          // usually means a filesystem problem worth seeing in the dev terminal.
          if (status >= 500) server.config.logger.error(`[catalog-api] ${message}`);
          sendJson(res, status, { error: message });
        }
      })();
    });
  },
});
