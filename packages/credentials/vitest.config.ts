import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // eddsa-rdfc-2022 canonicalization + the digitalbazaar conformance roundtrip
    // are not slow, but JSON-LD expansion has cold-start cost on first import.
    testTimeout: 20000,
  },
});
