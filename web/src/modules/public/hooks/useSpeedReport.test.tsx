// The consent-gated speed report (ANL-05, D-38, T-12-45). The speed reader module is replaced here, so no web-vitals code runs.
import { act, render, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { StrictMode } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { consentCookie, setConsent } from '@/test/consentFixtures';
import { server } from '@/test/msw';
import type { VitalReport } from '../speedReport';
import { useSpeedReport } from './useSpeedReport';

const reader = vi.hoisted(() => ({
  imported: 0,
  start: vi.fn<(report: VitalReport) => void>(),
}));

vi.mock('../speedReport', () => {
  reader.imported += 1;
  return { startSpeedReport: reader.start };
});

interface VitalsProbe {
  readonly requests: { body: unknown; csrf: string | null }[];
}

/** Answers speed reports with `answer` and records each body and its anti-CSRF header. */
function vitalsProbe(answer: () => Response = () => new HttpResponse(null, { status: 204 })): VitalsProbe {
  const probe: VitalsProbe = { requests: [] };
  server.use(
    http.post('*/api/v1/analytics/vitals', async ({ request }) => {
      probe.requests.push({ body: await request.json(), csrf: request.headers.get('X-CSPS-CSRF') });
      return answer();
    }),
  );
  return probe;
}

function Speed() {
  useSpeedReport(useLocation().pathname);
  return null;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Speed />
    </MemoryRouter>,
  );
}

function hidePage(): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
}

/** Lets any request that was going to be sent reach the probe. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 60));

/** The latest callback the reader was given, so a test can report more after the start. */
let report: VitalReport = () => undefined;

/** The reader reports these values at once, as web-vitals does with buffered entries. */
function readerReports(values: [Parameters<VitalReport>[0], number][]): void {
  reader.start.mockImplementation((callback) => {
    report = callback;
    for (const [name, value] of values) callback(name, value);
  });
}

beforeEach(() => {
  vi.resetModules();
  reader.imported = 0;
  reader.start.mockReset();
  report = () => undefined;
});

afterEach(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});

describe('useSpeedReport tracer (ANL-05)', () => {
  it('sends { path: "/", lcp: 2100 } once when the page is hidden, with a saved stats yes', async () => {
    setConsent({ cookie: consentCookie({ stats: true, map: true }) });
    readerReports([['LCP', 2100]]);
    const probe = vitalsProbe();

    renderAt('/');
    await waitFor(() => {
      expect(reader.start).toHaveBeenCalledTimes(1);
    });
    expect(probe.requests).toHaveLength(0);
    act(() => {
      hidePage();
    });

    await waitFor(() => {
      expect(probe.requests).toHaveLength(1);
    });
    expect(probe.requests[0]?.body).toEqual({ path: '/', lcp: 2100 });
    expect(probe.requests[0]?.csrf).toBe('1');
  });
});

describe('useSpeedReport without a stats yes (ANL-05, T-12-45)', () => {
  it('never loads the reader and sends nothing before a choice', async () => {
    setConsent({ cookie: null });
    readerReports([['LCP', 2100]]);
    const probe = vitalsProbe();

    renderAt('/');
    await settle();
    act(() => {
      hidePage();
    });
    await settle();

    expect(reader.imported).toBe(0);
    expect(reader.start).not.toHaveBeenCalled();
    expect(probe.requests).toHaveLength(0);
  });

  it('never loads the reader and sends nothing after Reject All', async () => {
    setConsent({ cookie: consentCookie({ stats: false, map: false }) });
    readerReports([['LCP', 2100]]);
    const probe = vitalsProbe();

    renderAt('/');
    await settle();
    act(() => {
      hidePage();
    });
    await settle();

    expect(reader.imported).toBe(0);
    expect(reader.start).not.toHaveBeenCalled();
    expect(probe.requests).toHaveLength(0);
  });

  it('never loads the reader and sends nothing under Global Privacy Control, even with a stats yes saved', async () => {
    setConsent({ cookie: consentCookie({ stats: true, map: true }), gpc: true });
    readerReports([['LCP', 2100]]);
    const probe = vitalsProbe();

    renderAt('/');
    await settle();
    act(() => {
      hidePage();
    });
    await settle();

    expect(reader.imported).toBe(0);
    expect(reader.start).not.toHaveBeenCalled();
    expect(probe.requests).toHaveLength(0);
  });

  it('starts the reader when a stats yes is saved later in the same page load', async () => {
    setConsent({ cookie: null });
    readerReports([['LCP', 1800]]);
    const probe = vitalsProbe();
    renderAt('/');
    await settle();
    expect(reader.start).not.toHaveBeenCalled();

    act(() => {
      setConsent({ cookie: consentCookie({ stats: true, map: false }) });
    });
    await waitFor(() => {
      expect(reader.start).toHaveBeenCalledTimes(1);
    });
    act(() => {
      hidePage();
    });

    await waitFor(() => {
      expect(probe.requests).toHaveLength(1);
    });
    expect(probe.requests[0]?.body).toEqual({ path: '/', lcp: 1800 });
  });

  it('sends nothing when stats are turned off before the page is hidden', async () => {
    setConsent({ cookie: consentCookie({ stats: true, map: true }) });
    readerReports([['LCP', 2100]]);
    const probe = vitalsProbe();
    renderAt('/');
    await waitFor(() => {
      expect(reader.start).toHaveBeenCalledTimes(1);
    });

    act(() => {
      setConsent({ cookie: consentCookie({ stats: false, map: true }) });
    });
    act(() => {
      hidePage();
    });
    await settle();

    expect(probe.requests).toHaveLength(0);
  });
});

describe('useSpeedReport body and sending (ANL-05)', () => {
  it('leaves out a metric that never reported', async () => {
    setConsent({ cookie: consentCookie({ stats: true, map: true }) });
    readerReports([
      ['LCP', 2100],
      ['INP', 180],
    ]);
    const probe = vitalsProbe();

    renderAt('/gallery');
    await waitFor(() => {
      expect(reader.start).toHaveBeenCalledTimes(1);
    });
    act(() => {
      hidePage();
    });

    await waitFor(() => {
      expect(probe.requests).toHaveLength(1);
    });
    expect(probe.requests[0]?.body).toEqual({ path: '/gallery', lcp: 2100, inp: 180 });
  });

  it('sends the latest value of each metric under the landing path', async () => {
    setConsent({ cookie: consentCookie({ stats: true, map: true }) });
    readerReports([['LCP', 2100]]);
    const probe = vitalsProbe();
    renderAt('/products');
    await waitFor(() => {
      expect(reader.start).toHaveBeenCalledTimes(1);
    });

    act(() => {
      report('CLS', 0.02);
      report('CLS', 0.07);
      report('LCP', 2400);
      hidePage();
    });

    await waitFor(() => {
      expect(probe.requests).toHaveLength(1);
    });
    expect(probe.requests[0]?.body).toEqual({ path: '/products', lcp: 2400, cls: 0.07 });
  });

  it('sends nothing when no metric has reported', async () => {
    setConsent({ cookie: consentCookie({ stats: true, map: true }) });
    readerReports([]);
    const probe = vitalsProbe();
    renderAt('/');
    await waitFor(() => {
      expect(reader.start).toHaveBeenCalledTimes(1);
    });

    act(() => {
      hidePage();
    });
    await settle();

    expect(probe.requests).toHaveLength(0);
  });

  it('sends one report for the page load, however often the page is hidden', async () => {
    setConsent({ cookie: consentCookie({ stats: true, map: true }) });
    readerReports([['LCP', 2100]]);
    const probe = vitalsProbe();
    renderAt('/');
    await waitFor(() => {
      expect(reader.start).toHaveBeenCalledTimes(1);
    });

    act(() => {
      hidePage();
      hidePage();
    });
    await settle();
    act(() => {
      hidePage();
    });
    await settle();

    expect(probe.requests).toHaveLength(1);
  });

  it('starts the reader once in React StrictMode, where effects run twice', async () => {
    setConsent({ cookie: consentCookie({ stats: true, map: true }) });
    readerReports([['LCP', 2100]]);
    const probe = vitalsProbe();
    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/']}>
          <Speed />
        </MemoryRouter>
      </StrictMode>,
    );
    await waitFor(() => {
      expect(reader.start).toHaveBeenCalledTimes(1);
    });

    act(() => {
      hidePage();
    });
    await settle();

    expect(reader.start).toHaveBeenCalledTimes(1);
    expect(probe.requests).toHaveLength(1);
  });

  it('stops listening when the layout goes away', async () => {
    setConsent({ cookie: consentCookie({ stats: true, map: true }) });
    readerReports([['LCP', 2100]]);
    const probe = vitalsProbe();
    const view = renderAt('/');
    await waitFor(() => {
      expect(reader.start).toHaveBeenCalledTimes(1);
    });
    view.unmount();

    act(() => {
      hidePage();
    });
    await settle();

    expect(probe.requests).toHaveLength(0);
  });

  it('logs nothing and does not retry when the send fails', async () => {
    setConsent({ cookie: consentCookie({ stats: true, map: true }) });
    readerReports([['LCP', 2100]]);
    const probe = vitalsProbe(() => HttpResponse.error());
    const logged = [vi.spyOn(console, 'error'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'log')];
    renderAt('/');
    await waitFor(() => {
      expect(reader.start).toHaveBeenCalledTimes(1);
    });

    act(() => {
      hidePage();
    });
    await waitFor(() => {
      expect(probe.requests).toHaveLength(1);
    });
    await settle();

    expect(probe.requests).toHaveLength(1);
    for (const spy of logged) expect(spy).not.toHaveBeenCalled();
  });
});
