import { afterEach, describe, expect, it } from 'vitest';
import { assertNoConsoleOutput, installConsoleGuard, resetConsoleGuard } from './consoleGuard';

describe('console guard', () => {
  afterEach(() => {
    // Leave the guard installed for setup.ts's own after-each check.
    installConsoleGuard();
  });

  it('fails on console.error and names the call', () => {
    installConsoleGuard();
    console.error('x');
    expect(() => {
      assertNoConsoleOutput();
    }).toThrow(/console\.error: x/);
  });

  it('fails on console.warn and names the call', () => {
    installConsoleGuard();
    console.warn('careful', 42);
    expect(() => {
      assertNoConsoleOutput();
    }).toThrow(/console\.warn: careful 42/);
  });

  it('lists every recorded call in order', () => {
    installConsoleGuard();
    console.warn('first');
    console.error(new Error('second'));
    expect(() => {
      assertNoConsoleOutput();
    }).toThrow(/console\.warn: first\nconsole\.error: Error: second/);
  });

  it('passes when nothing was written', () => {
    installConsoleGuard();
    expect(() => {
      assertNoConsoleOutput();
    }).not.toThrow();
  });

  it('reports a failure once, then starts clean', () => {
    installConsoleGuard();
    console.error('once');
    expect(() => {
      assertNoConsoleOutput();
    }).toThrow(/once/);
    expect(() => {
      assertNoConsoleOutput();
    }).not.toThrow();
  });

  it('resetConsoleGuard clears the record and restores the real console', () => {
    const real = console.error;
    resetConsoleGuard();
    const restored = console.error;
    installConsoleGuard();
    expect(console.error).not.toBe(restored);
    console.error('y');
    resetConsoleGuard();
    expect(console.error).toBe(restored);
    installConsoleGuard();
    expect(() => {
      assertNoConsoleOutput();
    }).not.toThrow();
    expect(real).not.toBe(restored);
  });
});
