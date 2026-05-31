// ============================================================================
// @redex/credentials — F6 OB 3.0 / W3C VC issuer toolkit (public surface).
// Server-side signing ONLY (invariants 2 + 7). M7 reuses this package to issue
// the real slice badges from real sign-offs.
// ============================================================================
export * from './issuer-config';
export * from './credential.types';
export * from './builder';
export * from './eddsa-rdfc-2022';
export * from './status-list';
export * from './did-web';
export * from './hosting';
export {
  base58btcEncode,
  base58btcDecode,
  toMultibase58btc,
  fromMultibase58btc,
  toMultibase64url,
  fromMultibase64url,
  ed25519PublicKeyMultibase,
  ed25519SecretKeyMultibase,
  decodeEd25519PublicKeyMultibase,
  decodeEd25519SecretKeyMultibase,
  MULTICODEC,
} from './multibase';
export {
  createDocumentLoader,
  issuerDocumentLoader,
  PINNED_CONTEXTS,
  type DocumentLoader,
  type RemoteDocument,
} from './contexts/index';
