import { describe, expect, it } from 'vitest';
import { FixtureSetManifest, assertFixtureLoadable, aeroFixture, iqPanelFixture } from './index';

describe('@redex/sim-schemas: fixture_set manifest (F5 §11)', () => {
  it('validates the toy aero fixture and the iq-panel sample', () => {
    expect(FixtureSetManifest.parse(aeroFixture).fixture_id).toBe(
      'adc-aero-x1100-create-customer-v3',
    );
    expect(FixtureSetManifest.parse(iqPanelFixture).source).toBe('iq_panel');
  });

  it('a sanitized fixture is loadable; an UNSANITIZED one is refused (invariant 6 gate)', () => {
    const ok = FixtureSetManifest.parse(aeroFixture);
    expect(() => assertFixtureLoadable(ok)).not.toThrow();
    const dirty = FixtureSetManifest.parse({ ...aeroFixture, sanitized: false });
    expect(() => assertFixtureLoadable(dirty)).toThrow(/not sanitized/);
  });

  it('rejects a source that is not an academy.fixture_source value', () => {
    expect(() => FixtureSetManifest.parse({ ...aeroFixture, source: 'wyze' })).toThrow();
  });

  it('rejects a navigate hotspot pointing at a missing screen', () => {
    const bad = JSON.parse(JSON.stringify(aeroFixture));
    bad.screens[0].hotspots.push({
      id: 'broken',
      rect: { x: 1, y: 1, w: 1, h: 1 },
      action: 'navigate',
      to_screen: 'ghost',
    });
    expect(() => FixtureSetManifest.parse(bad)).toThrow(/missing screen/);
  });
});
