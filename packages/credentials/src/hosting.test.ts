import { describe, it, expect } from 'vitest';
import {
  jsonResponse,
  didDocumentResponse,
  issuerProfileResponse,
  assertionResponse,
  statusListResponse,
  corsPreflightResponse,
  notFoundResponse,
  methodNotAllowedResponse,
  VC_MEDIA_TYPE,
  DID_MEDIA_TYPE,
} from './hosting';

describe('public hosting responses', () => {
  it('serves the DID document with the did media type, long cache, and open CORS', async () => {
    const res = didDocumentResponse({ id: 'did:web:redex.education' });
    expect(res.headers.get('content-type')).toBe(DID_MEDIA_TYPE);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('cache-control')).toContain('max-age=3600');
    expect((await res.json()).id).toBe('did:web:redex.education');
  });

  it('serves the issuer profile + assertion with the VC media type', () => {
    expect(issuerProfileResponse({}).headers.get('content-type')).toBe(VC_MEDIA_TYPE);
    expect(assertionResponse({}).headers.get('content-type')).toBe(VC_MEDIA_TYPE);
  });

  it('serves the status list with a SHORT cache so revocations propagate', () => {
    const res = statusListResponse({
      type: ['VerifiableCredential', 'BitstringStatusListCredential'],
    });
    expect(res.headers.get('cache-control')).toContain('max-age=60');
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('answers CORS preflight with 204 + allow-methods', () => {
    const res = corsPreflightResponse();
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-methods')).toContain('GET');
  });

  it('404 / 405 are not cached', () => {
    expect(notFoundResponse().status).toBe(404);
    expect(notFoundResponse().headers.get('cache-control')).toContain('max-age=0');
    expect(methodNotAllowedResponse().status).toBe(405);
  });

  it('jsonResponse defaults to application/json + max-age=300', () => {
    const res = jsonResponse({ ok: true });
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(res.headers.get('cache-control')).toContain('max-age=300');
  });
});
