// Vitest setup for every test file (vitest.config.ts setupFiles).
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { assertNoConsoleOutput, installConsoleGuard, resetConsoleGuard } from './consoleGuard';

// jsdom has no matchMedia (research Pitfall 20). The mock reports "no match" and its listeners do nothing.
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

// Any console.error or console.warn during a test fails it, React act and key warnings included (PRD 17.2).
beforeEach(() => {
  installConsoleGuard();
});

afterEach(() => {
  try {
    cleanup();
    assertNoConsoleOutput();
  } finally {
    resetConsoleGuard();
  }
});
