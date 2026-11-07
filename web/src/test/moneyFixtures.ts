// Money fixtures for component, service and route tests (plan 10-13): the caller's own money on hand typed from the generated
// contract, with made-up people, and an MSW handler that records every request to GET /api/v1/staff-money/me.
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type MyMoneyFixture = Schemas['StaffMoneyResponse'];

/** The made-up person of the money fixtures (a made-up account id; the same shape as the sections test uses). */
export const MY_MONEY_USER_ID = '0b0f6c1e-0000-4000-8000-000000000001';

/** A staff member holding 8,450.00 on a November day. Override any field. */
export function myMoneyFixture(overrides: Partial<MyMoneyFixture> = {}): MyMoneyFixture {
  return { userId: MY_MONEY_USER_ID, name: 'Liza Mercado', balance: 8450, today: '2026-11-04', ...overrides };
}

/** A staff member who spent more than they hold: 500.00 below zero (D-15, D-16). */
export function myMoneyNegativeFixture(overrides: Partial<MyMoneyFixture> = {}): MyMoneyFixture {
  return myMoneyFixture({ balance: -500, ...overrides });
}

/** A staff member holding nothing. */
export function myMoneyZeroFixture(overrides: Partial<MyMoneyFixture> = {}): MyMoneyFixture {
  return myMoneyFixture({ balance: 0, ...overrides });
}

type MyMoneyResponder = (url: URL) => Response | MyMoneyFixture | Promise<Response | MyMoneyFixture>;

/**
 * Answers `GET /api/v1/staff-money/me` with a fixture, or with a function that decides per call (a failure is a Response).
 * Returns every request made. A handler added later wins over an earlier one, so call this after `dashboardBackend` to replace
 * the default answer it registers.
 */
export function myMoneyBackend(answer: MyMoneyFixture | MyMoneyResponder = myMoneyFixture()): URL[] {
  const calls: URL[] = [];
  server.use(
    http.get('*/api/v1/staff-money/me', async ({ request }) => {
      const url = new URL(request.url);
      calls.push(url);
      const body = typeof answer === 'function' ? await answer(url) : answer;
      return body instanceof Response ? body : HttpResponse.json(body);
    }),
  );
  return calls;
}
