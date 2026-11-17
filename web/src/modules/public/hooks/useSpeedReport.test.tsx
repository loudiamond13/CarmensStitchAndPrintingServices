// The consent-gated speed report (ANL-05, D-38, T-12-45). The speed reader module is replaced here, so no web-vitals code runs.
import { act, render, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { http, HttpResponse } from 'msw';
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

/** The reader reports these values at once, as web-vitals does with buffered entries. */
function readerReports(values: [Parameters<VitalReport>[0], number][]): void {
  reader.start.mockImplementation((callback) => {
    for (const [name, value] of values) callback(name, value);
  });
}

beforeEach(() => {
  vi.resetModules();
  reader.imported = 0;
  reader.start.mockReset();
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
