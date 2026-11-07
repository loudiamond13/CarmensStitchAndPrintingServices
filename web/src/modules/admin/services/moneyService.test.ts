import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { createFakeFetch } from '@/test/fakeFetch';
import { myMoneyFixture } from '@/test/moneyFixtures';
import { createMoneyService, MyMoneyContractError, parseMyMoney } from './moneyService';

// The money call (MONEY-02, OR-5): typed, over the one HTTP client. The browser asks only for the caller's own figure.

afterEach(() => {
  vi.unstubAllGlobals();
});

function serviceWith(plans: Parameters<typeof createFakeFetch>[0]) {
  const fake = createFakeFetch(plans);
  return { fake, service: createMoneyService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch })) };
}

describe('moneyService.me', () => {
  it('calls GET /api/v1/staff-money/me with no parameters and resolves the typed answer', async () => {
    const money = myMoneyFixture();
    const { fake, service } = serviceWith([{ body: money }]);

    await expect(service.me()).resolves.toEqual(money);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('GET');
    const url = new URL(fake.calls[0]?.url ?? '', 'https://csps.invalid');
    expect(url.pathname).toBe('/api/v1/staff-money/me');
    expect(url.search).toBe('');
  });

  it("passes the caller's signal, so cancelling rejects with kind aborted", async () => {
    const { fake, service } = serviceWith([{ hang: true }]);
    const controller = new AbortController();

    const pending = service.me(controller.signal).then(
      () => 'resolved',
      (error: unknown) => error,
    );
    await vi.waitFor(() => {
      expect(fake.calls).toHaveLength(1);
    });
    controller.abort();

    expect(await pending).toMatchObject({ kind: 'aborted' });
  });
});

describe('parseMyMoney (wave 5 IN-01)', () => {
  it('keeps the person and the date and narrows a number balance unchanged', () => {
    expect(parseMyMoney(myMoneyFixture({ balance: 1234.5 }))).toEqual({
      userId: myMoneyFixture().userId,
      name: 'Liza Mercado',
      balance: 1234.5,
      today: '2026-11-04',
    });
  });

  it('narrows a balance that arrives as text, keeping the sign', () => {
    expect(parseMyMoney(myMoneyFixture({ balance: '-500.00' })).balance).toBe(-500);
    expect(parseMyMoney(myMoneyFixture({ balance: '0.00' })).balance).toBe(0);
  });

  it.each([
    ['blank text', ''],
    ['words', 'lots'],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('refuses a balance that is %s, so the card shows its failure instead of a wrong figure', (_what, balance) => {
    expect(() => parseMyMoney(myMoneyFixture({ balance }))).toThrow(MyMoneyContractError);
  });
});
