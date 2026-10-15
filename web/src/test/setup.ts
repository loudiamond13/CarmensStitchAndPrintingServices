// Vitest setup for every test file (vitest.config.ts test.setupFiles).
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { installConsoleGuard } from './consoleGuard';
import { server } from './msw';

// jsdom has no matchMedia (research Pitfall 20). The mock reports "no match" and its listeners do nothing. Node-env
// tests (*.node.test.ts) have no window, so they skip it.
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

// Any console.error or console.warn during a test fails that test (Pitfall 20). Vitest runs after-each hooks in
// reverse registration order (sequence.hooks 'stack'), so registering the guard first makes its check run after the
// cleanup below, and warnings raised while unmounting fail the test too.
installConsoleGuard();

// Component tests run behind an MSW server: a request without a handler fails the test, so no test reaches a real
// network (MSW 3 renamed the onUnhandledRequest option to onUnhandledFrame). Registered before the cleanup below, so
// handlers reset after the unmount. Node-env tests skip it.
if (typeof window !== 'undefined') {
  beforeAll(() => {
    server.listen({ onUnhandledFrame: 'error' });
  });
  afterEach(() => {
    server.resetHandlers();
  });
  afterAll(() => {
    server.close();
  });
}

// Unmount what each test rendered (Vitest globals are off, so RTL cannot register this itself).
afterEach(() => {
  cleanup();
});
