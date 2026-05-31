// Ambient shims for the digitalbazaar / jsonld-signatures REFERENCE verifier stack.
// These are devDependencies used ONLY in conformance tests (Node/vitest) to check our
// eddsa-rdfc-2022 output against an independent implementation — they ship no types.
// They are NOT used by the Deno issue-badge signer or any runtime path.
declare module 'jsonld-signatures';
declare module '@digitalbazaar/data-integrity';
declare module '@digitalbazaar/eddsa-rdfc-2022-cryptosuite';
declare module '@digitalbazaar/ed25519-multikey';
