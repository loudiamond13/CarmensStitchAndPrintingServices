// Fails a test that writes to console.error or console.warn, React act and key warnings included (PRD 17.2).
// setup.ts installs the guard before each test and asserts after each one.
type GuardedMethod = 'error' | 'warn';

interface RecordedCall {
  readonly method: GuardedMethod;
  readonly args: readonly unknown[];
}

let calls: RecordedCall[] = [];
let originals: Pick<Console, GuardedMethod> | undefined;

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

/** Replaces console.error and console.warn with recorders. Calling it again while installed changes nothing. */
export function installConsoleGuard(): void {
  if (originals !== undefined) {
    return;
  }
  originals = { error: console.error, warn: console.warn };
  console.error = (...args: unknown[]) => {
    calls.push({ method: 'error', args });
  };
  console.warn = (...args: unknown[]) => {
    calls.push({ method: 'warn', args });
  };
}

/** Throws one Error listing every recorded call, then starts a fresh record. */
export function assertNoConsoleOutput(): void {
  if (calls.length === 0) {
    return;
  }
  const lines = calls.map((call) => `console.${call.method}: ${call.args.map(describeArgument).join(' ')}`);
  calls = [];
  throw new Error(`Unexpected console output:\n${lines.join('\n')}`);
}

/** Clears the record and puts the real console methods back. */
export function resetConsoleGuard(): void {
  calls = [];
  if (originals !== undefined) {
    console.error = originals.error;
    console.warn = originals.warn;
    originals = undefined;
  }
}
