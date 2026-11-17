// The page-view beacon (ANL-05, ANL-06, UI-SPEC CB1 "After the choice"): the hook sends the path only, and the machine
// holds the landing view while the bar asks.
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { consentCookie, setConsent } from '@/test/consentFixtures';
import { pageViewProbe } from '@/test/msw';
import { usePageViewBeacon } from './usePageViewBeacon';

function Beacon() {
  usePageViewBeacon(useLocation().pathname);
  return null;
}

function setReferrer(value: string): void {
  Object.defineProperty(document, 'referrer', { configurable: true, value });
}

afterEach(() => {
  setReferrer('');
});

describe('usePageViewBeacon tracer (ANL-05)', () => {
  it('sends only { path } for /gallery?q=jersey#top when a choice is saved and there is no referrer', async () => {
    const probe = pageViewProbe();

    render(
      <MemoryRouter initialEntries={['/gallery?q=jersey#top']}>
        <Beacon />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(probe.requests).toHaveLength(1);
    });
    expect(probe.requests[0]?.body).toEqual({ path: '/gallery' });
    expect(probe.requests[0]?.csrf).toBe('1');
  });

  it('adds the referrer hostname, never the full address, to the first view', async () => {
    setReferrer('https://www.example.test/groups/riders?ref=share#top');
    const probe = pageViewProbe();

    render(
      <MemoryRouter initialEntries={['/products']}>
        <Beacon />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(probe.requests).toHaveLength(1);
    });
    expect(probe.requests[0]?.body).toEqual({ path: '/products', referrerHost: 'www.example.test' });
  });

  it('under GPC with no saved choice sends the view at once', async () => {
    setConsent({ cookie: null, gpc: true });
    const probe = pageViewProbe();

    render(
      <MemoryRouter initialEntries={['/contact']}>
        <Beacon />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(probe.requests).toHaveLength(1);
    });
    expect(probe.requests[0]?.body).toEqual({ path: '/contact' });
  });

  it('keeps a saved choice from being read as a reason to wait', async () => {
    setConsent({ cookie: consentCookie({ stats: true, map: true }) });
    const probe = pageViewProbe();

    render(
      <MemoryRouter initialEntries={['/']}>
        <Beacon />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(probe.requests).toHaveLength(1);
    });
  });
});
