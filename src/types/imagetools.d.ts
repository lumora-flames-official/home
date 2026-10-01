/**
 * Types the `&as=picture` image imports in `src/data/assets.ts`.
 *
 * `vite-imagetools@12` ships no `client.d.ts`, so without this the query-suffixed
 * imports fall back to `any` and `ResponsivePicture` stops being enforced at the one
 * place it matters — where the data enters the app.
 *
 * Keyed on the `&as=picture` **suffix** rather than the full query, deliberately: a
 * declaration naming the widths (`?w=640;1024;1344&as=picture`) would silently stop
 * matching the day someone tunes them, and silently returning `any` is exactly the
 * failure this file exists to prevent. `as=picture` is the part that determines the
 * shape, so that is the part matched.
 */
declare module '*&as=picture' {
  const picture: import('./image').ResponsivePicture;
  export default picture;
}
