// Fail-on-console guard for Vitest (research Pitfall 20, PRD 17.2). setup.ts installs it once per test file: every
// console.error and console.warn is recorded instead of printed, and the after-each check fails the test that wrote
// them, React act and key warnings included. React format strings are shown unsubstituted, which is acceptable.
// Other console methods are left alone.
import { afterEach } from 'vitest';

export interface ConsoleCall {
  readonly method: 'error' | 'warn';
  readonly args: readonly unknown[];
}

let calls: ConsoleCall[] = [];
let installed = false;

function describeArgument(argument: unknown): string {
  if (typeof argument === 'string') {
    return argument;
  }
  if (argument instanceof Error) {
    return `${argument.name}: ${argument.message}`;
  }
  if (argument === undefined || typeof argument === 'function' || typeof argument === 'symbol') {
    return String(argument);
  }
  try {
    return JSON.stringify(argument);
  } catch {
    return '[unserializable value]';
  }
}

/** Hands over every call recorded since the last collection and starts a fresh record. */
export function collectConsole(): readonly ConsoleCall[] {
  const recorded = calls;
  calls = [];
  return recorded;
}

/** Throws one Error listing every recorded call in order (and clears the record); does nothing when it is empty. */
export function assertNoConsoleOutput(): void {
  const recorded = collectConsole();
  if (recorded.length === 0) {
    return;
  }
  const lines = recorded.map((call) => `console.${call.method}: ${call.args.map(describeArgument).join(' ')}`);
  throw new Error(`Unexpected console output in this test:\n${lines.join('\n')}`);
}

/**
 * Replaces console.error and console.warn with recorders and registers the after-each check that fails the current
 * test on any recorded call. Calling it again changes nothing.
 */
export function installConsoleGuard(): void {
  if (installed) {
    return;
  }
  installed = true;
  console.error = (...args: unknown[]) => {
    calls.push({ method: 'error', args });
  };
  console.warn = (...args: unknown[]) => {
    calls.push({ method: 'warn', args });
  };
  afterEach(() => {
    assertNoConsoleOutput();
  });
}
