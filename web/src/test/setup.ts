// Vitest setup for every test file (vitest.config.ts test.setupFiles).
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { MAPS_KEY } from '@/modules/public/mapChoice';
import { installConsoleGuard } from './consoleGuard';
import { consentRulesLoaded, setConsent } from './consentFixtures';
import { pageViewHandler, server } from './msw';
import {
  demoGallery,
  demoHome,
  demoLines,
  demoSite,
  galleryHandler,
  homeHandler,
  openStatusAt0900,
  openStatusHandler,
  privacyContactHandler,
  productLinesHandler,
  resetPublicData,
  siteHandler,
} from './publicFixtures';

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

// jsdom has no scrollIntoView either. A no-op lets components that scroll a control into view run under test.
if (typeof window !== 'undefined') {
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value: () => undefined,
  });
}

// Any console.error or console.warn during a test fails that test (Pitfall 20). Vitest runs after-each hooks in
// reverse registration order (sequence.hooks 'stack'), so registering the guard first makes its check run after the
// cleanup below, and warnings raised while unmounting fail the test too.
installConsoleGuard();

// Component tests run behind an MSW server: a request without a handler fails the test, so no test reaches a real
// network (MSW 3 renamed the onUnhandledRequest option to onUnhandledFrame). Registered before the cleanup below, so
// handlers reset after the unmount. Node-env tests skip it.
// Every public page reads the shop facts, so each test starts with the demo shop answering that route and the open status
// (Contact reads it); a test that needs another answer calls server.use and with no public data left from the test before.
if (typeof window !== 'undefined') {
  beforeAll(() => {
    server.listen({ onUnhandledFrame: 'error' });
  });
  beforeEach(() => {
    server.use(
      siteHandler(demoSite),
      openStatusHandler(openStatusAt0900),
      productLinesHandler(demoLines),
      homeHandler(demoHome),
      galleryHandler(demoGallery),
      privacyContactHandler(),
      pageViewHandler(),
    );
  });
  // Every test starts with no saved Show Map tap (D-65).
  beforeEach(() => {
    try {
      window.localStorage.removeItem(MAPS_KEY);
    } catch {
      // A test that replaced storage with a throwing one restores it itself.
    }
  });
  // Every test starts with a decided Reject All in an in-memory jar, so no page test sees the cookie bar; a test for a
  // first visit calls setConsent({ cookie: null }).
  beforeEach(async () => {
    setConsent();
    await consentRulesLoaded();
  });
  afterEach(() => {
    server.resetHandlers();
    resetPublicData();
  });
  afterAll(() => {
    server.close();
  });
}

// Unmount what each test rendered (Vitest globals are off, so RTL cannot register this itself).
afterEach(() => {
  cleanup();
});
