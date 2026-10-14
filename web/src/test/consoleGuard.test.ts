// Proves the fail-on-console guard (Pitfall 20): console.error and console.warn during a test are recorded and fail
// that test at afterEach; other console methods pass through. setup.ts installs the guard for every test file.
import { describe, expect, it, vi } from 'vitest';
import { assertNoConsoleOutput, collectConsole, installConsoleGuard } from './consoleGuard';

describe('console guard', () => {
  it('records console.error, and the after-each check fails on it', () => {
    installConsoleGuard();
    console.error('x');
    expect(() => {
      assertNoConsoleOutput();
    }).toThrow('Unexpected console output in this test:\nconsole.error: x');
  });

  it('records console.warn with every argument', () => {
    installConsoleGuard();
    console.warn('careful', 42, { a: 1 });
    expect(collectConsole()).toEqual([{ method: 'warn', args: ['careful', 42, { a: 1 }] }]);
  });

  it('lists every recorded call in order, and an Error by name and message', () => {
    installConsoleGuard();
    console.warn('first');
    console.error(new TypeError('second'));
    expect(() => {
      assertNoConsoleOutput();
    }).toThrow('console.warn: first\nconsole.error: TypeError: second');
  });

  it('prints React-style format strings unsubstituted, objects as JSON', () => {
    installConsoleGuard();
    console.error('Warning: %s is odd', 'Thing', { key: 'k' }, undefined);
    expect(() => {
      assertNoConsoleOutput();
    }).toThrow('console.error: Warning: %s is odd Thing {"key":"k"} undefined');
  });

  it('collectConsole() hands over the record once, then starts clean', () => {
    installConsoleGuard();
    console.error('once');
    expect(collectConsole()).toEqual([{ method: 'error', args: ['once'] }]);
    expect(collectConsole()).toEqual([]);
    expect(() => {
      assertNoConsoleOutput();
    }).not.toThrow();
  });

  it('allows console.info', () => {
    installConsoleGuard();
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    console.info('fine');
    expect(info).toHaveBeenCalledWith('fine');
    expect(collectConsole()).toEqual([]);
  });

  it('passes when nothing was written', () => {
    installConsoleGuard();
    expect(() => {
      assertNoConsoleOutput();
    }).not.toThrow();
  });
});
