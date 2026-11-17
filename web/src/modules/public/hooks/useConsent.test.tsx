// The consent store (ANL-01, ANL-07, D-16, D-17, D-43): state from the saved cookie, the Manila business day, and the
// save flow through the service.
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { consentCookie, consentProbe, demoDecision, FAKE_CONSENT_ID, setConsent } from '@/test/consentFixtures';
import { server } from '@/test/msw';
import { formatConsentCookie, parseConsentCookie } from '../consentCookie';
import { manilaBusinessDay } from '../consentRules';
import { consentCookieText, writeBrowserCookie } from '../consentSave';
import { consentStore, createConsentStore, resetConsentStore, useConsent } from './useConsent';

const TODAY = '2026-11-17';

/** The save tests never clear, so a service double has nothing to answer. */
const unusedClear = () => Promise.reject(new Error('clear is not used here'));

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

  it('counts a cookie the server stamped with today in Manila as current while the device date is a day behind (D-43)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-11-16T20:00:00Z'));
      const store = createConsentStore({
        readCookie: () => formatConsentCookie(consentCookie({ decidedOn: TODAY, stats: true })),
        writeCookie: () => undefined,
        gpc: false,
      });
      await waitFor(() => {
        expect(store.getSnapshot().statsAllowed).toBe(true);
      });
      expect(store.getSnapshot().needsChoice).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('needs no rules on a first visit: it asks at once, and never asks under GPC', () => {
    const first = createConsentStore({ readCookie: () => undefined, gpc: false });
    expect(first.getSnapshot().needsChoice).toBe(true);
    const gpc = createConsentStore({ readCookie: () => undefined, gpc: true });
    expect(gpc.getSnapshot().needsChoice).toBe(false);
  });

  it('trusts a saved choice until the rules load, then asks again when it is stale, and tells its listeners', async () => {
    const store = createConsentStore({
      readCookie: () => formatConsentCookie(consentCookie({ policyVersion: '0.0' })),
      gpc: false,
    });
    const listener = vi.fn();
    store.subscribe(listener);
    expect(store.getSnapshot().needsChoice).toBe(false);

    await waitFor(() => {
      expect(store.getSnapshot().needsChoice).toBe(true);
    });
    expect(listener).toHaveBeenCalled();
    expect(store.getSnapshot().cookie?.policyVersion).toBe('0.0');
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

    await waitFor(() => {
      expect(parseConsentCookie(jar.value)).toMatchObject({
        stats: true,
        map: true,
        pending: true,
        policyVersion: '0.1',
      });
    });
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

describe('a browser that will not keep the cookie (ANL-01, no nagging)', () => {
  it('still applies the choice on this page: the bar closes and does not come back', async () => {
    const probe = consentProbe();
    const writes: (string | null)[] = [];
    resetConsentStore({
      readCookie: () => undefined,
      writeCookie: (value) => {
        writes.push(value);
      },
      gpc: false,
    });
    const { result } = renderHook(() => useConsent());
    expect(result.current.needsChoice).toBe(true);

    await result.current.acceptAll('bar');

    await waitFor(() => {
      expect(result.current.statsAllowed).toBe(true);
    });
    expect(result.current.needsChoice).toBe(false);
    expect(result.current.mapAllowed).toBe(true);
    expect(writes).toHaveLength(1);
    expect(probe.requests).toHaveLength(1);
  });
});

describe('Reject All (D-16, D-17)', () => {
  it('saves stats and map off, posts both false and announces it', async () => {
    const probe = consentProbe();
    const jar = setConsent({ cookie: null });
    const { result } = renderHook(() => useConsent());

    await result.current.rejectAll('bar');

    expect(parseConsentCookie(jar.value)).toMatchObject({ stats: false, map: false, pending: true });
    expect(probe.requests[0]?.body).toEqual({ policyVersion: '0.1', stats: false, map: false, source: 'bar' });
    expect(result.current.needsChoice).toBe(false);
    expect(result.current.statsAllowed).toBe(false);
    expect(result.current.announcement).toBe('Your cookie choice is saved.');
  });
});

describe('the provisional cookie text', () => {
  it('is Path=/, Secure, SameSite=Lax, 12 months, with no Domain (the __Host- rules)', () => {
    const text = consentCookieText('1_x');
    expect(text).toBe('__Host-csps_consent=1_x; Path=/; Secure; SameSite=Lax; Max-Age=31536000');
    expect(text).not.toContain('Domain');
  });

  it('removes the cookie with Max-Age=0 and an empty value', () => {
    expect(consentCookieText(null)).toBe('__Host-csps_consent=; Path=/; Secure; SameSite=Lax; Max-Age=0');
  });

  it('is written to document.cookie by the browser writer', () => {
    const write = vi.spyOn(document, 'cookie', 'set').mockImplementation(() => undefined);
    writeBrowserCookie('1_x');
    writeBrowserCookie(null);
    expect(write).toHaveBeenNthCalledWith(1, consentCookieText('1_x'));
    expect(write).toHaveBeenNthCalledWith(2, consentCookieText(null));
  });
});

describe('a store made without a cookie writer uses the browser (ANL-01)', () => {
  const conflict = (code: string) => Object.assign(new Error('Conflict'), { status: 409, code });
  const POLICY_CHANGED_ERROR = conflict('consent.policy-changed');

  it('writes the provisional cookie to document.cookie when a choice is made', async () => {
    const write = vi.spyOn(document, 'cookie', 'set').mockImplementation(() => undefined);
    const record = vi.fn(() => Promise.resolve(demoDecision));
    const store = createConsentStore({
      readCookie: () => undefined,
      gpc: false,
      today: () => TODAY,
      loadService: () => Promise.resolve({ record, clear: unusedClear }),
    });
    await store.acceptAll('bar');
    expect(write).toHaveBeenCalledTimes(1);
    const text = String(write.mock.calls[0]?.[0]);
    expect(text).toMatch(/^__Host-csps_consent=.+; Path=\/; Secure; SameSite=Lax; Max-Age=31536000$/);
    expect(record).toHaveBeenCalledTimes(1);
  });

  it('removes the provisional cookie from document.cookie when the server says the policy changed', async () => {
    const write = vi.spyOn(document, 'cookie', 'set').mockImplementation(() => undefined);
    const store = createConsentStore({
      readCookie: () => undefined,
      gpc: false,
      today: () => TODAY,
      loadService: () => Promise.resolve({ record: () => Promise.reject(POLICY_CHANGED_ERROR), clear: unusedClear }),
    });
    await store.acceptAll('bar');
    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenLastCalledWith(consentCookieText(null));
    expect(store.getSnapshot().needsChoice).toBe(true);
  });

  it('keeps a cookie that is no longer provisional when the policy conflict arrives', async () => {
    let value: string | undefined;
    const writeCookie = vi.fn((next: string | null) => {
      value = next ?? undefined;
    });
    const store = createConsentStore({
      readCookie: () => value,
      writeCookie,
      gpc: false,
      today: () => TODAY,
      loadService: () =>
        Promise.resolve({
          record: () => {
            value = formatConsentCookie(consentCookie({ stats: true, map: true, decidedOn: TODAY }));
            return Promise.reject(POLICY_CHANGED_ERROR);
          },
          clear: unusedClear,
        }),
    });
    await store.acceptAll('bar');
    expect(writeCookie).toHaveBeenCalledTimes(1);
    expect(parseConsentCookie(value)).toMatchObject({ pending: false, stats: true });
    expect(store.getSnapshot().announcement).toBeNull();
  });

  it('does not remove the cookie for a conflict that is not the policy change', async () => {
    const write = vi.spyOn(document, 'cookie', 'set').mockImplementation(() => undefined);
    const store = createConsentStore({
      readCookie: () => undefined,
      gpc: false,
      today: () => TODAY,
      loadService: () => Promise.resolve({ record: () => Promise.reject(conflict('other')), clear: unusedClear }),
    });
    await store.acceptAll('bar');
    expect(write).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().needsChoice).toBe(false);
  });

  it.each([
    ['a text', 'boom'],
    ['null', null],
  ])('treats a send that fails with %s as an ordinary failure: the pending choice stays', async (_name, thrown) => {
    let value: string | undefined;
    const store = createConsentStore({
      readCookie: () => value,
      writeCookie: (next) => {
        value = next ?? undefined;
      },
      gpc: false,
      today: () => TODAY,
      loadService: () =>
        Promise.resolve({ record: () => Promise.reject(thrown as unknown as Error), clear: unusedClear }),
    });
    await store.rejectAll('bar');
    expect(parseConsentCookie(value)).toMatchObject({ stats: false, map: false, pending: true });
    expect(store.getSnapshot().needsChoice).toBe(false);
  });
});

describe('Save with a chosen mix (settings window)', () => {
  it('writes and posts exactly the chosen stats and map parts, and announces the save', async () => {
    const probe = consentProbe();
    const jar = setConsent({ cookie: null });
    const { result } = renderHook(() => useConsent());

    await result.current.save({ stats: true, map: false }, 'settings');

    expect(parseConsentCookie(jar.value)).toMatchObject({ stats: true, map: false, pending: true });
    expect(probe.requests[0]?.body).toEqual({ policyVersion: '0.1', stats: true, map: false, source: 'settings' });
    expect(result.current.needsChoice).toBe(false);
    expect(result.current.announcement).toBe('Your cookie choice is saved.');
  });
});

describe('manilaBusinessDay with a formatter that gives no parts', () => {
  it('returns separators only instead of throwing', () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'formatToParts').mockReturnValue([]);
    expect(manilaBusinessDay(new Date('2026-11-17T00:00:00Z'))).toBe('--');
  });
});

describe('a failed save keeps the choice (UI-SPEC error, ANL-07)', () => {
  it.each([
    ['the network fails', () => HttpResponse.error()],
    ['the server answers 500', () => HttpResponse.json({ title: 'Failed', status: 500 }, { status: 500 })],
    ['the server answers 429', () => HttpResponse.json({ title: 'Too many', status: 429 }, { status: 429 })],
  ])('when %s: no bar, the pending cookie stays, no error is shown', async (_name, answer) => {
    server.use(http.post('*/api/v1/analytics/consent', answer));
    const jar = setConsent({ cookie: null });
    const { result } = renderHook(() => useConsent());

    await result.current.rejectAll('bar');

    expect(result.current.needsChoice).toBe(false);
    expect(parseConsentCookie(jar.value)).toMatchObject({ stats: false, map: false, pending: true });
    expect(result.current.announcement).toBe('Your cookie choice is saved.');
  });

  it('sends the pending choice again once, with its chain id, and stops when the server accepts it', async () => {
    let calls = 0;
    const bodies: unknown[] = [];
    server.use(
      http.post('*/api/v1/analytics/consent', async ({ request }) => {
        calls += 1;
        bodies.push(await request.json());
        return calls === 1 ? HttpResponse.error() : HttpResponse.json(demoDecision);
      }),
    );
    const jar = setConsent({ cookie: null });
    const { result } = renderHook(() => useConsent());
    await result.current.acceptAll('bar');
    const provisional = parseConsentCookie(jar.value);

    await result.current.resendPending();
    await result.current.resendPending();

    expect(calls).toBe(2);
    expect(bodies[1]).toEqual({
      consentId: provisional?.consentId,
      policyVersion: '0.1',
      stats: true,
      map: true,
      source: 'bar',
    });
  });

  it('does nothing without a pending cookie, and does not even load the service', async () => {
    const loadService = vi.fn();
    const store = createConsentStore({
      readCookie: () => formatConsentCookie(consentCookie()),
      writeCookie: () => undefined,
      gpc: false,
      loadService,
    });
    await store.resendPending();
    expect(loadService).not.toHaveBeenCalled();
  });

  it('sends nothing again while the first send is still on its way', async () => {
    let release: () => void = () => undefined;
    const record = vi.fn(
      () =>
        new Promise<typeof demoDecision>((resolve) => {
          release = () => {
            resolve(demoDecision);
          };
        }),
    );
    let value: string | undefined;
    const store = createConsentStore({
      readCookie: () => value,
      writeCookie: (next) => {
        value = next ?? undefined;
      },
      gpc: false,
      loadService: () => Promise.resolve({ record, clear: unusedClear }),
    });

    const saving = store.acceptAll('bar');
    await waitFor(() => {
      expect(record).toHaveBeenCalledTimes(1);
    });
    await store.resendPending();
    expect(record).toHaveBeenCalledTimes(1);
    release();
    await saving;
  });
});

describe('a stale policy version (409, D-22)', () => {
  it('removes the provisional cookie and shows the bar again', async () => {
    server.use(
      http.post('*/api/v1/analytics/consent', () =>
        HttpResponse.json(
          { title: 'The cookie policy changed.', status: 409, code: 'consent.policy-changed' },
          { status: 409, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    );
    const jar = setConsent({ cookie: null });
    const { result } = renderHook(() => useConsent());

    await result.current.acceptAll('bar');

    expect(jar.value).toBeUndefined();
    expect(jar.writes.at(-1)).toBeNull();
    expect(result.current.needsChoice).toBe(true);
    expect(result.current.statsAllowed).toBe(false);
    expect(result.current.announcement).toBeNull();
  });
});

describe('when the bar asks again (D-20, D-22, ANL-07)', () => {
  it('asks for a choice saved under an older Cookie Policy version', () => {
    setConsent({ cookie: consentCookie({ policyVersion: '0.0' }) });
    expect(renderHook(() => useConsent()).result.current.needsChoice).toBe(true);
  });

  it('asks again on the day a choice turns 12 months old, not the day before', () => {
    const today = () => '2026-11-17';
    setConsent({ cookie: consentCookie({ decidedOn: '2025-11-17' }), today });
    expect(renderHook(() => useConsent()).result.current.needsChoice).toBe(true);

    setConsent({ cookie: consentCookie({ decidedOn: '2025-11-18' }), today });
    expect(renderHook(() => useConsent()).result.current.needsChoice).toBe(false);
  });

  it('never asks under Global Privacy Control, and a save under it stores stats off', async () => {
    const probe = consentProbe();
    const jar = setConsent({ cookie: null, gpc: true });
    const { result } = renderHook(() => useConsent());
    expect(result.current.needsChoice).toBe(false);
    expect(result.current.gpc).toBe(true);

    await result.current.acceptAll('settings');

    expect(parseConsentCookie(jar.value)).toMatchObject({ stats: false, map: true });
    expect(probe.requests[0]?.body).toMatchObject({ stats: false, map: true, source: 'settings' });
    expect(result.current.statsAllowed).toBe(false);
  });

  it('follows the answer when the server saw GPC: stats stay off and the bar stays away', async () => {
    consentProbe(() => HttpResponse.json({ ...demoDecision, gpc: true, stats: false }));
    setConsent({ cookie: null });
    const { result } = renderHook(() => useConsent());

    await result.current.acceptAll('bar');

    await waitFor(() => {
      expect(result.current.gpc).toBe(true);
    });
    expect(result.current.statsAllowed).toBe(false);
    expect(result.current.needsChoice).toBe(false);
  });
});

describe('Always show maps (D-18)', () => {
  it('saves only the map part: stats stay unchosen, the bar stays, and nothing is announced', async () => {
    const probe = consentProbe();
    const jar = setConsent({ cookie: null });
    const { result } = renderHook(() => useConsent());

    await result.current.allowMaps();

    expect(parseConsentCookie(jar.value)).toMatchObject({ stats: null, map: true, pending: true });
    expect(probe.requests[0]?.body).toEqual({ policyVersion: '0.1', stats: null, map: true, source: 'map-link' });
    expect(result.current.mapAllowed).toBe(true);
    expect(result.current.statsAllowed).toBe(false);
    expect(result.current.needsChoice).toBe(true);
    expect(result.current.announcement).toBeNull();
  });

  it('keeps the stats choice already made', async () => {
    consentProbe();
    const jar = setConsent({ cookie: consentCookie({ stats: true, map: false }) });
    const { result } = renderHook(() => useConsent());

    await result.current.allowMaps();

    expect(parseConsentCookie(jar.value)).toMatchObject({ stats: true, map: true });
    expect(result.current.mapAllowed).toBe(true);
  });
});

describe('whether the saved choice still counts (CS1 saved line)', () => {
  it('is false with no cookie and true for a current choice', async () => {
    setConsent({ cookie: null });
    const none = renderHook(() => useConsent());
    expect(none.result.current.current).toBe(false);
    none.unmount();

    setConsent({ cookie: consentCookie({ stats: true }) });
    const saved = renderHook(() => useConsent());
    await waitFor(() => {
      expect(saved.result.current.current).toBe(true);
    });
  });

  it('is false for a choice made under an older Cookie Policy version, and for one 12 months old', async () => {
    setConsent({ cookie: consentCookie({ policyVersion: '0.0' }) });
    const old = renderHook(() => useConsent());
    await waitFor(() => {
      expect(old.result.current.cookie).not.toBeNull();
    });
    expect(old.result.current.current).toBe(false);
    old.unmount();

    setConsent({ cookie: consentCookie({ decidedOn: '2025-11-17' }), today: () => TODAY });
    const year = renderHook(() => useConsent());
    await waitFor(() => {
      expect(year.result.current.cookie).not.toBeNull();
    });
    expect(year.result.current.current).toBe(false);
  });
});

describe('the saved announcement (ANL-07, A11Y-02)', () => {
  it('changes its text on a repeat save, so a screen reader reads it again', async () => {
    consentProbe();
    setConsent();
    const { result } = renderHook(() => useConsent());

    await act(async () => {
      await result.current.save({ stats: false, map: false }, 'settings');
    });
    const first = result.current.announcement;
    await act(async () => {
      await result.current.save({ stats: true, map: false }, 'settings');
    });
    const second = result.current.announcement;

    expect(first).toBe('Your cookie choice is saved.');
    expect(second).not.toBe(first);
    expect(second?.trim()).toBe('Your cookie choice is saved.');
  });
});

describe('the settings window state', () => {
  it('opens, closes, and gives focus back to the control that opened it', () => {
    setConsent({ cookie: null });
    const opener = document.createElement('button');
    document.body.append(opener);
    const { result } = renderHook(() => useConsent());

    act(() => {
      result.current.openSettings(opener);
    });
    expect(result.current.settingsOpen).toBe(true);

    act(() => {
      result.current.closeSettings();
    });
    expect(result.current.settingsOpen).toBe(false);
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it('closes without error when the control that opened it has left the page', () => {
    setConsent({ cookie: null });
    const opener = document.createElement('button');
    document.body.append(opener);
    const { result } = renderHook(() => useConsent());
    act(() => {
      result.current.openSettings(opener);
    });
    opener.remove();

    act(() => {
      result.current.closeSettings();
    });
    expect(result.current.settingsOpen).toBe(false);
    expect(opener).not.toHaveFocus();
  });

  it('closes without error when it was never opened from a control', () => {
    setConsent({ cookie: null });
    const { result } = renderHook(() => useConsent());
    act(() => {
      result.current.closeSettings();
    });
    expect(result.current.settingsOpen).toBe(false);
  });

  it('is loading from the first open until the window reports ready, and not again on a later open', () => {
    setConsent({ cookie: null });
    const { result } = renderHook(() => useConsent());
    expect(result.current.settingsLoading).toBe(false);

    act(() => {
      result.current.openSettings();
    });
    expect(result.current.settingsLoading).toBe(true);

    act(() => {
      result.current.settingsReady();
    });
    expect(result.current.settingsLoading).toBe(false);

    act(() => {
      result.current.closeSettings();
      result.current.openSettings();
    });
    expect(result.current.settingsOpen).toBe(true);
    expect(result.current.settingsLoading).toBe(false);
  });

  it('tells nobody when the window reports ready and nothing was waiting', () => {
    setConsent({ cookie: null });
    const changed = vi.fn();
    const stop = consentStore.subscribe(changed);

    consentStore.settingsReady();

    stop();
    expect(changed).not.toHaveBeenCalled();
  });
});

describe('clearData (ANL-04, D-19, D-31, D-41)', () => {
  const NEW_CHAIN = 'fedcba9876543210fedcba9876543210';

  beforeEach(() => {
    localStorage.setItem('csps-admin-theme', 'espresso');
    sessionStorage.setItem('orders-view', 'cards');
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('calls the server first, then clears this browser, keeps the cookie the server set and leaves stats and map off', async () => {
    const jar = setConsent({ cookie: consentCookie({ stats: true, map: true }) });
    const seen: { local: string | null; session: string | null; csrf: string | null; body: string }[] = [];
    server.use(
      http.post('*/api/v1/analytics/clear', async ({ request }) => {
        seen.push({
          local: localStorage.getItem('csps-admin-theme'),
          session: sessionStorage.getItem('orders-view'),
          csrf: request.headers.get('X-CSPS-CSRF'),
          body: await request.text(),
        });
        // The browser accepts the server's Set-Cookie for the new reset decision.
        jar.value = formatConsentCookie(consentCookie({ consentId: NEW_CHAIN, stats: false, map: false }));
        return HttpResponse.json({ ...demoDecision, consentId: NEW_CHAIN, stats: false, map: false });
      }),
    );
    const { result } = renderHook(() => useConsent());
    await waitFor(() => {
      expect(result.current.statsAllowed).toBe(true);
    });

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.clearData();
    });

    expect(outcome).toBe('cleared');
    expect(seen).toEqual([{ local: 'espresso', session: 'cards', csrf: '1', body: '' }]);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(parseConsentCookie(jar.value)).toMatchObject({
      consentId: NEW_CHAIN,
      stats: false,
      map: false,
      pending: false,
    });
    expect(jar.writes).toEqual([]);
    expect(result.current).toMatchObject({ statsAllowed: false, mapAllowed: false, needsChoice: false });
  });

  it('forgets a choice held only in memory, so nothing of the old choice is left', async () => {
    resetConsentStore({ readCookie: () => undefined, writeCookie: () => undefined, gpc: false });
    consentProbe();
    const { result } = renderHook(() => useConsent());
    await act(async () => {
      await result.current.acceptAll('bar');
    });
    await waitFor(() => {
      expect(result.current.statsAllowed).toBe(true);
    });
    server.use(
      http.post('*/api/v1/analytics/clear', () => HttpResponse.json({ ...demoDecision, stats: false, map: false })),
    );

    await act(async () => {
      await result.current.clearData();
    });

    expect(result.current.statsAllowed).toBe(false);
    expect(result.current.mapAllowed).toBe(false);
  });

  it.each([
    ['the network fails', 'failed', () => HttpResponse.error()],
    ['the server answers 500', 'failed', () => HttpResponse.json({ title: 'Failed', status: 500 }, { status: 500 })],
    ['the server answers 403', 'failed', () => HttpResponse.json({ title: 'Forbidden', status: 403 }, { status: 403 })],
    [
      'the server answers 429',
      'rate-limited',
      () => HttpResponse.json({ title: 'Too many tries.', status: 429, code: 'rate-limited' }, { status: 429 }),
    ],
  ])('when %s: nothing is cleared in the browser and the outcome is %s', async (_name, expected, answer) => {
    server.use(http.post('*/api/v1/analytics/clear', answer));
    const jar = setConsent({ cookie: consentCookie({ stats: true, map: true }) });
    const before = jar.value;
    const { result } = renderHook(() => useConsent());
    await waitFor(() => {
      expect(result.current.statsAllowed).toBe(true);
    });

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.clearData();
    });

    expect(outcome).toBe(expected);
    expect(localStorage.getItem('csps-admin-theme')).toBe('espresso');
    expect(sessionStorage.getItem('orders-view')).toBe('cards');
    expect(jar.value).toBe(before);
    expect(jar.writes).toEqual([]);
    expect(result.current).toMatchObject({ statsAllowed: true, mapAllowed: true });
  });
});
