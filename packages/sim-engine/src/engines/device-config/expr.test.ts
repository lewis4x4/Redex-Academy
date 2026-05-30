import { describe, expect, it } from 'vitest';
import { evalExpr, type ExprContext } from './expr';

const ctx = (fields: Record<string, unknown>, editOrder: string[] = []): ExprContext => ({
  fields: new Map(Object.entries(fields)),
  editOrder,
});

describe('device-config expr interpreter (whitelisted; never eval)', () => {
  it('field() equality on strings and booleans', () => {
    expect(evalExpr("field('mode') == 'fail_safe'", ctx({ mode: 'fail_safe' }))).toBe(true);
    expect(evalExpr("field('mode') == 'fail_safe'", ctx({ mode: 'fail_locked' }))).toBe(false);
    expect(evalExpr("field('cloud') == true", ctx({ cloud: true }))).toBe(true);
    expect(evalExpr("field('cloud') == true", ctx({ cloud: false }))).toBe(false);
  });

  it('&&, ||, ! and comparisons', () => {
    const c = ctx({ a: 'x', b: 'y', n: 30 });
    expect(evalExpr("field('a') == 'x' && field('b') == 'y'", c)).toBe(true);
    expect(evalExpr("field('a') == 'x' && field('b') == 'z'", c)).toBe(false);
    expect(evalExpr("field('a') == 'z' || field('b') == 'y'", c)).toBe(true);
    expect(evalExpr("!(field('a') == 'z')", c)).toBe(true);
    expect(evalExpr("field('n') > 0 && field('n') <= 240", c)).toBe(true);
    expect(evalExpr("field('n') >= 60", c)).toBe(false);
  });

  it('set_before / reassigned_before read the edit order', () => {
    const c = ctx({ a: 1, b: 2 }, ['a', 'b', 'a']);
    expect(evalExpr("set_before('a','b')", c)).toBe(true);
    expect(evalExpr("set_before('b','a')", c)).toBe(false);
    expect(evalExpr("reassigned_before('a','b')", ctx({ a: 1, b: 2 }, ['b', 'a']))).toBe(false);
  });

  it('REJECTS anything outside the grammar (no code execution from a spec)', () => {
    expect(() => evalExpr('1 + 1', ctx({}))).toThrow();
    expect(() => evalExpr("globalThis['x']", ctx({}))).toThrow();
    expect(() => evalExpr('process.exit(1)', ctx({}))).toThrow();
    expect(() => evalExpr("field('a') = 'b'", ctx({ a: 'b' }))).toThrow(); // assignment, not ==
    expect(() => evalExpr("danger('a')", ctx({}))).toThrow(); // unknown function
  });
});
