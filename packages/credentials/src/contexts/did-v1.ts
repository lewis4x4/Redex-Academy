// AUTO-VENDORED — DO NOT EDIT BY HAND.
// W3C DID v1
// Source: https://www.w3.org/ns/did/v1
// Vendored for OFFLINE, deterministic JSON-LD processing (no network fetch at
// sign/verify time — a security + Deno-runtime requirement). Re-vendor with
// scripts/vendor-contexts.ts if the upstream context is revised.
const DID_V1_CONTEXT = {
  '@context': {
    '@protected': true,
    id: '@id',
    type: '@type',
    alsoKnownAs: {
      '@id': 'https://www.w3.org/ns/activitystreams#alsoKnownAs',
      '@type': '@id',
    },
    assertionMethod: {
      '@id': 'https://w3id.org/security#assertionMethod',
      '@type': '@id',
      '@container': '@set',
    },
    authentication: {
      '@id': 'https://w3id.org/security#authenticationMethod',
      '@type': '@id',
      '@container': '@set',
    },
    capabilityDelegation: {
      '@id': 'https://w3id.org/security#capabilityDelegationMethod',
      '@type': '@id',
      '@container': '@set',
    },
    capabilityInvocation: {
      '@id': 'https://w3id.org/security#capabilityInvocationMethod',
      '@type': '@id',
      '@container': '@set',
    },
    controller: {
      '@id': 'https://w3id.org/security#controller',
      '@type': '@id',
    },
    keyAgreement: {
      '@id': 'https://w3id.org/security#keyAgreementMethod',
      '@type': '@id',
      '@container': '@set',
    },
    service: {
      '@id': 'https://www.w3.org/ns/did#service',
      '@type': '@id',
      '@context': {
        '@protected': true,
        id: '@id',
        type: '@type',
        serviceEndpoint: {
          '@id': 'https://www.w3.org/ns/did#serviceEndpoint',
          '@type': '@id',
        },
      },
    },
    verificationMethod: {
      '@id': 'https://w3id.org/security#verificationMethod',
      '@type': '@id',
    },
  },
} as const;
export default DID_V1_CONTEXT;
