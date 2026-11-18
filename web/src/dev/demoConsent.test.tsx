import { cleanup, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { consentStore } from '@/modules/public/hooks/useConsent';
import { OpenedCookieSettings } from './previews/OpenedCookieSettings';
import { StaticConsentBar } from './previews/StaticConsentBar';

// The consent demos reconfigure the one shared consent store. Leaving a demo must put the real store back, or the public pages
// reached later in the same tab would run on the demo cookie and the demo Global Privacy Control flag.

afterEach(cleanup);

describe('the consent demos and the real consent store', () => {
  it('puts the real store back when the Cookie Settings demo unmounts', async () => {
    const before = consentStore.getSnapshot().needsChoice;
    const view = render(
      <MemoryRouter>
        <OpenedCookieSettings state="gpc" />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(consentStore.getSnapshot().gpc).toBe(true);
    });

    view.unmount();

    expect(consentStore.getSnapshot()).toMatchObject({ gpc: false, settingsOpen: false, needsChoice: before });
  });

  it('puts the real store back when the cookie bar demo unmounts', () => {
    const view = render(
      <MemoryRouter>
        <StaticConsentBar />
      </MemoryRouter>,
    );
    expect(consentStore.getSnapshot().needsChoice).toBe(true);
    consentStore.reconfigure({ readCookie: () => undefined, gpc: true });

    view.unmount();

    expect(consentStore.getSnapshot().gpc).toBe(false);
  });
});
