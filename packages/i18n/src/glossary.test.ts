import { describe, expect, it } from 'vitest';
import {
  SAFETY_GLOSSARY,
  SME_REVIEW_REQUIRED,
  getGlossaryEntry,
  getGlossaryKeys,
} from './glossary';

describe('locked safety glossary', () => {
  it('contains the 15 locked terms + the fail-secure clarifying sibling (16 total)', () => {
    expect(getGlossaryKeys()).toHaveLength(16);
  });

  it('has unique, stable, dot-namespaced keys', () => {
    const keys = getGlossaryKeys();
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(k).toMatch(/^safety\.glossary\.[a-z0-9_]+$/);
  });

  it('every entry is locked with a non-empty EN canonical term + definition', () => {
    for (const e of SAFETY_GLOSSARY) {
      expect(e.locked).toBe(true);
      expect(e.term.en.length).toBeGreaterThan(0);
      expect(e.definitionEn.length).toBeGreaterThan(0);
    }
  });

  it('never machine-fills ES/TL safety renderings (SME review gate)', () => {
    for (const e of SAFETY_GLOSSARY) {
      expect(e.term.es).toBe(SME_REVIEW_REQUIRED);
      expect(e.term.tl).toBe(SME_REVIEW_REQUIRED);
    }
  });

  it('keeps fail-safe / fail-locked / fail-secure as three distinct locked terms', () => {
    expect(getGlossaryEntry('safety.glossary.fail_safe')?.term.en).toBe('fail-safe');
    expect(getGlossaryEntry('safety.glossary.fail_locked')?.term.en).toBe('fail-locked');
    expect(getGlossaryEntry('safety.glossary.fail_secure')?.term.en).toBe('fail-secure');
  });
});
