// AUTO-VENDORED — DO NOT EDIT BY HAND.
// W3C Multikey v1
// Source: https://w3id.org/security/multikey/v1
// Vendored for OFFLINE, deterministic JSON-LD processing (no network fetch at
// sign/verify time — a security + Deno-runtime requirement). Re-vendor with
// scripts/vendor-contexts.ts if the upstream context is revised.
const MULTIKEY_V1_CONTEXT = {
  '@context': {
    id: '@id',
    type: '@type',
    '@protected': true,
    Multikey: {
      '@id': 'https://w3id.org/security#Multikey',
      '@context': {
        '@protected': true,
        id: '@id',
        type: '@type',
        controller: {
          '@id': 'https://w3id.org/security#controller',
          '@type': '@id',
        },
        revoked: {
          '@id': 'https://w3id.org/security#revoked',
          '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
        },
        expires: {
          '@id': 'https://w3id.org/security#expiration',
          '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
        },
        publicKeyMultibase: {
          '@id': 'https://w3id.org/security#publicKeyMultibase',
          '@type': 'https://w3id.org/security#multibase',
        },
        secretKeyMultibase: {
          '@id': 'https://w3id.org/security#secretKeyMultibase',
          '@type': 'https://w3id.org/security#multibase',
        },
      },
    },
  },
} as const;
export default MULTIKEY_V1_CONTEXT;
