import {
  branchingExample,
  deviceConfigExample,
  ac203MagVsStrikeSpec,
  ac203ArmatureMountSpec,
  ac203ButtonPlacementSpec,
  ac203FollowThePowerSpec,
  ac203VirtualDoorSpec,
} from '@redex/sim-schemas';
import { describe, expect, it } from 'vitest';
import { createI18nResolver } from './resolver';
import { SIM_STRINGS } from './sim-strings';

const examples = [
  { name: 'ac203 branching', spec: branchingExample },
  { name: 'aero device-config', spec: deviceConfigExample },
  // AC-203 (the flagship) — the 4 new embeddable sims + the device-config virtual-door build.
  { name: 'ac203 mag-vs-strike-pick', spec: ac203MagVsStrikeSpec },
  { name: 'ac203 armature-mount', spec: ac203ArmatureMountSpec },
  { name: 'ac203 button-placement', spec: ac203ButtonPlacementSpec },
  { name: 'ac203 follow-the-power', spec: ac203FollowThePowerSpec },
  { name: 'ac203 virtual-door-maglock', spec: ac203VirtualDoorSpec },
];

describe('sim i18n discipline: EN+ES resolve; safety glossary non-overridable', () => {
  for (const { name, spec } of examples) {
    for (const locale of ['en', 'es'] as const) {
      it(`${name}: every declared i18n key resolves in ${locale}`, () => {
        const r = createI18nResolver(SIM_STRINGS, locale);
        const keys = spec.envelope.i18n_string_keys ?? [];
        expect(keys.length).toBeGreaterThan(0);
        const missing = keys.filter((k) => !r.has(k) || r.t(k) === k || r.t(k).trim() === '');
        expect(missing).toEqual([]);
      });
    }
  }

  it('framework-chrome keys rendered by the renderers resolve in EN+ES (no raw key on screen)', () => {
    // These are passed to t() by the renderers (retry button, submit button) — they
    // must resolve, not render as the literal key (the Finding-3 regression).
    for (const locale of ['en', 'es'] as const) {
      const r = createI18nResolver(SIM_STRINGS, locale);
      for (const key of ['sim.common.action.retry', 'sim.common.action.submit']) {
        expect(r.t(key)).not.toBe(key);
        expect(r.t(key).trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('a sim string table CANNOT shadow a locked safety glossary term', () => {
    const r = createI18nResolver(
      {
        en: { 'safety.glossary.fail_safe': 'HACKED' },
        es: { 'safety.glossary.fail_safe': 'HACKED' },
      },
      'en',
    );
    expect(r.t('safety.glossary.fail_safe')).toBe('fail-safe'); // locked canonical wins
  });
});
