// The consent store (ANL-01, ANL-07, D-16, D-17, D-43): state from the saved cookie, the Manila business day, and the
// save flow through the service.
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { consentProbe, consentCookie, FAKE_CONSENT_ID, setConsent } from '@/test/consentFixtures';
import { formatConsentCookie, parseConsentCookie } from '../consentCookie';
import { createConsentStore, manilaBusinessDay, useConsent } from './useConsent';

const TODAY = '2026-11-17';

describe('manilaBusinessDay (D-43)', () => {
  it.each([
    ['2026-11-16T20:00:00Z', '2026-11-17'],
    ['2026-11-17T15:59:59Z', '2026-11-17'],
    ['2026-11-17T16:00:00Z', '2026-11-18'],
    ['2026-12-31T16:30:00Z', '2027-01-01'],
  ])('%s is the Manila day %s', (instant, day) => {
    expect(manilaBusinessDay(new Date(instant))).toBe(day);
  });
});

describe('consent state from the saved cookie', () => {
  it('asks on a first visit and allows nothing', () => {
    setConsent({ cookie: null });
    const { result } = renderHook(() => useConsent());
    expect(result.current).toMatchObject({
      cookie: null,
      needsChoice: true,
      statsAllowed: false,
      mapAllowed: false,
      settingsOpen: false,
      announcement: null,
    });
  });

  it('does not ask again once a current choice is saved, and reads stats and map from it', () => {
    setConsent({ cookie: consentCookie({ stats: true, map: false }) });
    const { result } = renderHook(() => useConsent());
    expect(result.current.needsChoice).toBe(false);
    expect(result.current.statsAllowed).toBe(true);
    expect(result.current.mapAllowed).toBe(false);
    expect(result.current.cookie?.consentId).toBe(FAKE_CONSENT_ID);
  });

  it('counts a cookie the server stamped with today in Manila as current while the device date is a day behind (D-43)', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-11-16T20:00:00Z'));
      const store = createConsentStore({
        readCookie: () => formatConsentCookie(consentCookie({ decidedOn: TODAY })),
        writeCookie: () => undefined,
        gpc: false,
      });
      expect(store.getSnapshot().needsChoice).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reads the cookie once and writes nothing before a choice', () => {
    const writeCookie = vi.fn();
    const readCookie = vi.fn(() => undefined);
    const store = createConsentStore({ readCookie, writeCookie, gpc: false, today: () => TODAY });
    expect(store.getSnapshot()).toBe(store.getSnapshot());
    expect(store.getSnapshot().needsChoice).toBe(true);
    expect(writeCookie).not.toHaveBeenCalled();
  });
});

describe('Accept All (D-17, ANL-07)', () => {
  it('writes the provisional cookie at once, posts the choice with the policy version and the CSRF header, and announces it', async () => {
    const probe = consentProbe();
    const jar = setConsent({ cookie: null });
    const { result } = renderHook(() => useConsent());

    const saving = result.current.acceptAll('bar');

    const provisional = parseConsentCookie(jar.value);
    expect(provisional).toMatchObject({ stats: true, map: true, pending: true, policyVersion: '0.1' });
    await waitFor(() => {
      expect(result.current.needsChoice).toBe(false);
    });
    expect(result.current.statsAllowed).toBe(true);
    expect(result.current.mapAllowed).toBe(true);
    expect(result.current.announcement).toBe('Your cookie choice is saved.');

    await saving;
    expect(probe.requests).toEqual([
      { body: { policyVersion: '0.1', stats: true, map: true, source: 'bar' }, csrf: '1' },
    ]);
  });

  it('posts a first decision without a chain id and keeps the id of an earlier one', async () => {
    const probe = consentProbe();
    setConsent({ cookie: null });
    const { result } = renderHook(() => useConsent());
    await result.current.acceptAll('bar');
    expect(probe.requests[0]?.body).not.toHaveProperty('consentId');

    setConsent({ cookie: consentCookie({ policyVersion: '0.0' }) });
    const again = renderHook(() => useConsent());
    await again.result.current.rejectAll('bar');
    expect(probe.requests[1]?.body).toMatchObject({ consentId: FAKE_CONSENT_ID });
  });
});
