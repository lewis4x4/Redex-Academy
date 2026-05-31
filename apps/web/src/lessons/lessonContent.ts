// The committed MDX lesson bodies, bundled as raw strings and keyed by
// units.content_ref.mdx_key (e.g. "ac-101/u1"). Runtime-compiled by LessonScreen
// (@mdx-js/mdx evaluate) — the key is a DB value, so a build-time .mdx loader can't
// resolve it. R2/Stream media never inline here; they go through <Media/> by key.
const RAW = import.meta.glob('./content/**/*.mdx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

// './content/ac-101/u1.mdx' → 'ac-101/u1'
const BY_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(RAW).map(([path, src]) => [
    path.replace(/^\.\/content\//, '').replace(/\.mdx$/, ''),
    src,
  ]),
);

/** The raw MDX body for a content_ref.mdx_key, or null if none is committed. */
export function getLessonMdx(mdxKey: string | null): string | null {
  if (!mdxKey) return null;
  return BY_KEY[mdxKey] ?? null;
}
