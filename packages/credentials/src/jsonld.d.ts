// Minimal ambient types for the parts of `jsonld` (no bundled types) we use.
// We deliberately type only `canonize` with the options eddsa-rdfc-2022 needs.
declare module 'jsonld' {
  interface CanonizeOptions {
    algorithm?: 'URDNA2015' | 'RDFC-1.0';
    format?: 'application/n-quads';
    documentLoader?: (
      url: string,
    ) => Promise<{ contextUrl?: string | undefined; documentUrl: string; document: unknown }>;
    /** jsonld "safe mode": throw on lossy/undefined-term mappings. We keep it ON. */
    safe?: boolean;
  }
  const jsonld: {
    canonize(input: unknown, options?: CanonizeOptions): Promise<string>;
  };
  export default jsonld;
}
