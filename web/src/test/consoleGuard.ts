// Inert placeholder (plan 02-04 Task 3 RED): the fail-on-console guard lands in the GREEN commit.

export interface ConsoleCall {
  readonly method: 'error' | 'warn';
  readonly args: readonly unknown[];
}

export function installConsoleGuard(): void {
  // inert
}

export function collectConsole(): readonly ConsoleCall[] {
  return [];
}

export function assertNoConsoleOutput(): void {
  // inert
}
