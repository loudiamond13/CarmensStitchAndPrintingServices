import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { createFakeFetch } from '@/test/fakeFetch';
import {
  ANA_ID,
  JOMAR_ID,
  LIZA_ID,
  ledgerDeletedEntryFixture,
  ledgerEntryFixture,
  ledgerPageFixture,
  handoverSavedFixture,
  MY_MONEY_USER_ID,
  myMoneyFixture,
  PAOLO_ID,
  staffBalancesFixture,
  staffPersonFixture,
  TRANSFER_ID,
  transferDeletedFixture,
  transferItemFixture,
  transferListFixture,
  transferRecipientsFixture,
  transferSavedFixture,
} from '@/test/moneyFixtures';
import {
  createMoneyService,
  LedgerContractError,
  MyMoneyContractError,
  parseLedgerPage,
  parseMyMoney,
  parsePersonMoney,
  parseStaffBalances,
  parseTransferPage,
  pickHandoverRecipients,
  pickTransferRecipients,
  StaffBalancesContractError,
  toTransferPeople,
  toTransferTarget,
  TransferContractError,
} from './moneyService';

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

describe('moneyService.recipients (MONEY-04, D-56)', () => {
  it('calls GET /api/v1/money-transfers/recipients with no parameters and resolves the list as sent', async () => {
    const people = transferRecipientsFixture();
    const { fake, service } = serviceWith([{ body: people }]);

    await expect(service.recipients()).resolves.toEqual(people);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('GET');
    expect(fake.calls[0]?.url).toBe('/api/v1/money-transfers/recipients');
  });

  it("passes the caller's signal, so cancelling rejects with kind aborted", async () => {
    const { fake, service } = serviceWith([{ hang: true }]);
    const controller = new AbortController();

    const pending = service.recipients(controller.signal).then(
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

describe('moneyService.create (MONEY-04, SEC-06)', () => {
  const body = { toUserId: LIZA_ID, amount: '2000.00', transferDate: '2026-11-04', note: null };

  it('calls POST /api/v1/money-transfers with the body and the Idempotency-Key and resolves the saved transfer', async () => {
    const saved = transferSavedFixture();
    const { fake, service } = serviceWith([{ status: 201, body: saved }]);

    await expect(service.create(body, 'key-1')).resolves.toEqual(saved);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('POST');
    expect(fake.calls[0]?.url).toBe('/api/v1/money-transfers');
    expect(fake.calls[0]?.headers.get('Idempotency-Key')).toBe('key-1');
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual(body);
  });
});

describe('moneyService.ledger (MONEY-02, D-41)', () => {
  it('calls GET /api/v1/staff-money/me/ledger?page=2&pageSize=20 for the caller and does not send deleted=false', async () => {
    const page = ledgerPageFixture();
    const { fake, service } = serviceWith([{ body: page }]);

    await expect(service.ledger('me', { page: 2, pageSize: 20, deleted: false })).resolves.toEqual(page);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('GET');
    expect(fake.calls[0]?.url).toBe('/api/v1/staff-money/me/ledger?page=2&pageSize=20');
  });

  it('sends deleted=true only when a Manager asks for deleted transfers', async () => {
    const { fake, service } = serviceWith([{ body: ledgerPageFixture() }]);

    await service.ledger('me', { page: 1, pageSize: 50, deleted: true });

    expect(fake.calls[0]?.url).toBe('/api/v1/staff-money/me/ledger?page=1&pageSize=50&deleted=true');
  });

  it("asks for another person's ledger by their id, encoded in the path", async () => {
    const { fake, service } = serviceWith([{ body: ledgerPageFixture() }]);

    await service.ledger(LIZA_ID, { page: 1, pageSize: 20, deleted: false });

    expect(fake.calls[0]?.url).toBe(`/api/v1/staff-money/${LIZA_ID}/ledger?page=1&pageSize=20`);
  });

  it("passes the caller's signal, so cancelling rejects with kind aborted", async () => {
    const { fake, service } = serviceWith([{ hang: true }]);
    const controller = new AbortController();

    const pending = service.ledger('me', { page: 1, pageSize: 20, deleted: false }, controller.signal).then(
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

describe('parseLedgerPage (MONEY-02, wave 5 IN-01)', () => {
  it('keeps every row in the order sent, with the server amounts and balances as finite numbers and the empty side null', () => {
    const page = parseLedgerPage(ledgerPageFixture());

    expect(page.rows.map((row) => row.kind)).toEqual([
      'order-expense',
      'company-expense',
      'transfer-out',
      'transfer-in',
      'refund-handed-back',
      'payment-received',
    ]);
    expect(page.rows.map((row) => row.balanceAfter)).toEqual([-500, 950, 1700, 3700, 1700, 2000]);
    expect(page.rows[0]).toMatchObject({ moneyIn: null, moneyOut: 1450 });
    expect(page.rows[5]).toMatchObject({ moneyIn: 2000, moneyOut: null });
    expect(page).toMatchObject({ total: 6, page: 1, pageSize: 20, balance: -500, includesDeleted: false });
  });

  it('reads figures that arrive as plain decimal text, keeping the sign', () => {
    const page = parseLedgerPage(
      ledgerPageFixture([ledgerEntryFixture({ moneyIn: '2500.50', balanceAfter: '-12.25' })], {
        balance: '-12.25',
        total: '1',
        page: '1',
        pageSize: '20',
      }),
    );

    expect(page.rows[0]).toMatchObject({ moneyIn: 2500.5, balanceAfter: -12.25 });
    expect(page).toMatchObject({ balance: -12.25, total: 1, page: 1, pageSize: 20 });
  });

  it('keeps a deleted transfer with its face amount and no balance after it', () => {
    const page = parseLedgerPage(ledgerPageFixture([ledgerDeletedEntryFixture()], { includesDeleted: true }));

    expect(page.rows[0]).toMatchObject({ isDeleted: true, moneyOut: 2000, balanceAfter: null });
  });

  it.each([
    ['a row amount', { moneyIn: 'abc' }],
    ['a row balance', { balanceAfter: '0x10' }],
    ['a row amount that is not finite', { moneyOut: Number.POSITIVE_INFINITY }],
  ])('refuses the whole answer when %s is not a plain decimal', (_name, overrides) => {
    const page = ledgerPageFixture([ledgerEntryFixture(overrides)]);

    expect(() => parseLedgerPage(page)).toThrow(LedgerContractError);
  });

  it.each(['balance', 'total', 'page', 'pageSize'] as const)(
    'refuses the whole answer when the page %s is not a figure',
    (key) => {
      expect(() => parseLedgerPage(ledgerPageFixture([], { [key]: 'many' }))).toThrow(LedgerContractError);
    },
  );

  it('refuses a row with a kind the browser does not know, so no row is drawn with a wrong title', () => {
    const page = ledgerPageFixture([ledgerEntryFixture({ kind: 'bonus' })]);

    expect(() => parseLedgerPage(page)).toThrow(LedgerContractError);
  });
});

describe('pickTransferRecipients (wave 6 IN-03)', () => {
  it('leaves the signed-in person out and keeps the rest in the order sent, without isYou', () => {
    expect(pickTransferRecipients(toTransferPeople(transferRecipientsFixture()))).toEqual([
      { id: LIZA_ID, name: 'Liza Mercado', status: 'active' },
      { id: PAOLO_ID, name: 'Paolo Garcia', status: 'active' },
      { id: JOMAR_ID, name: 'Jomar Santos', status: 'deactivated' },
      { id: ANA_ID, name: 'Ana Villanueva', status: 'deleted' },
    ]);
  });

  it('refuses a person with a status the browser does not know, so they are never shown', () => {
    const odd = { id: LIZA_ID, name: 'Liza Mercado', status: 'suspended', isYou: false };

    expect(pickTransferRecipients(toTransferPeople([odd, ...transferRecipientsFixture()]))).toHaveLength(4);
    expect(pickTransferRecipients(toTransferPeople([odd]))).toEqual([]);
  });

  it('carries no figure: a person has an id, a name and a status only', () => {
    const [first] = pickTransferRecipients(toTransferPeople(transferRecipientsFixture()));

    expect(Object.keys(first ?? {}).sort()).toEqual(['id', 'name', 'status']);
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

describe('moneyService.handover (D-17, MONEY-04, SEC-06)', () => {
  const body = {
    fromUserId: JOMAR_ID,
    toUserId: LIZA_ID,
    amount: '2000.00',
    transferDate: '2026-11-04',
    note: null,
  };

  it('calls POST /api/v1/money-transfers/handovers with the body and the Idempotency-Key and resolves the saved hand-over', async () => {
    const saved = handoverSavedFixture();
    const { fake, service } = serviceWith([{ status: 201, body: saved }]);

    await expect(service.handover(body, 'key-1')).resolves.toEqual(saved);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('POST');
    expect(fake.calls[0]?.url).toBe('/api/v1/money-transfers/handovers');
    expect(fake.calls[0]?.headers.get('Idempotency-Key')).toBe('key-1');
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual(body);
  });
});

describe('the recipients answer (D-56, wave 6 IN-03; plan 10-19)', () => {
  it('toTransferPeople keeps the signed-in person, marked, and leaves out any status the browser does not know', () => {
    const odd = { id: LIZA_ID, name: 'Liza Mercado', status: 'suspended', isYou: false };

    expect(
      toTransferPeople([odd, ...transferRecipientsFixture()]).map((person) => [person.name, person.isYou]),
    ).toEqual([
      ['Carmen Reyes', true],
      ['Liza Mercado', false],
      ['Paolo Garcia', false],
      ['Jomar Santos', false],
      ['Ana Villanueva', false],
    ]);
    expect(toTransferPeople([odd])).toEqual([]);
  });

  it('pickHandoverRecipients offers active staff only, the signed-in Manager first, and never a leaver (wave 6 IN-03)', () => {
    const people = toTransferPeople([
      { id: LIZA_ID, name: 'Liza Mercado', status: 'active', isYou: false },
      { id: JOMAR_ID, name: 'Jomar Santos', status: 'deactivated', isYou: false },
      { id: MY_MONEY_USER_ID, name: 'Carmen Reyes', status: 'active', isYou: true },
      { id: ANA_ID, name: 'Ana Villanueva', status: 'deleted', isYou: false },
      { id: PAOLO_ID, name: 'Paolo Garcia', status: 'active', isYou: false },
    ]);

    expect(pickHandoverRecipients(people)).toEqual([
      { id: MY_MONEY_USER_ID, name: 'Carmen Reyes', isYou: true },
      { id: LIZA_ID, name: 'Liza Mercado', isYou: false },
      { id: PAOLO_ID, name: 'Paolo Garcia', isYou: false },
    ]);
  });

  it('pickHandoverRecipients is empty when no one is active', () => {
    expect(
      pickHandoverRecipients(
        toTransferPeople([{ id: JOMAR_ID, name: 'Jomar Santos', status: 'deactivated', isYou: false }]),
      ),
    ).toEqual([]);
  });
});

describe('moneyService.person (MONEY-03, D-42)', () => {
  it('calls GET /api/v1/staff-money/{userId} with no parameters and resolves the answer as sent', async () => {
    const jomar = staffPersonFixture();
    const { fake, service } = serviceWith([{ body: jomar }]);

    await expect(service.person(JOMAR_ID)).resolves.toEqual(jomar);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('GET');
    expect(fake.calls[0]?.url).toBe(`/api/v1/staff-money/${JOMAR_ID}`);
  });

  it('encodes the id, so a path-like value can never leave the route', async () => {
    const { fake, service } = serviceWith([{ body: staffPersonFixture() }]);

    await service.person('../me');

    expect(fake.calls[0]?.url).toBe('/api/v1/staff-money/..%2Fme');
  });

  it("passes the caller's signal, so cancelling rejects with kind aborted", async () => {
    const { fake, service } = serviceWith([{ hang: true }]);
    const controller = new AbortController();

    const pending = service.person(JOMAR_ID, controller.signal).then(
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

describe('parsePersonMoney (MONEY-03, wave 5 IN-01)', () => {
  it('keeps the person, the date, the role and the standing, and narrows the balance', () => {
    expect(parsePersonMoney(staffPersonFixture())).toEqual({
      userId: JOMAR_ID,
      name: 'Jomar Santos',
      role: 'Admin',
      status: 'deactivated',
      balance: 2000,
      today: '2026-11-04',
    });
  });

  it('narrows a balance that arrives as text, keeping the sign', () => {
    expect(parsePersonMoney(staffPersonFixture({ balance: '-300.00' })).balance).toBe(-300);
  });

  it.each([
    ['blank text', ''],
    ['words', 'lots'],
    ['NaN', Number.NaN],
  ])('refuses a balance that is %s', (_what, balance) => {
    expect(() => parsePersonMoney(staffPersonFixture({ balance }))).toThrow(MyMoneyContractError);
  });

  it('refuses a standing the browser does not know, so no wrong badge is drawn', () => {
    expect(() => parsePersonMoney(staffPersonFixture({ status: 'suspended' }))).toThrow(MyMoneyContractError);
  });
});

/** The first row of the All Staff fixture (Carmen). */
function firstItem() {
  const [first] = staffBalancesFixture().items;
  if (first === undefined) throw new Error('The All Staff fixture has no rows.');
  return first;
}

describe('moneyService.staff (MONEY-03, D-42)', () => {
  it('calls GET /api/v1/staff-money with no parameters and resolves the answer as sent', async () => {
    const everyone = staffBalancesFixture();
    const { fake, service } = serviceWith([{ body: everyone }]);

    await expect(service.staff()).resolves.toEqual(everyone);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('GET');
    expect(fake.calls[0]?.url).toBe('/api/v1/staff-money');
  });

  it("passes the caller's signal, so cancelling rejects with kind aborted", async () => {
    const { fake, service } = serviceWith([{ hang: true }]);
    const controller = new AbortController();

    const pending = service.staff(controller.signal).then(
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

describe('parseStaffBalances (MONEY-03, wave 5 IN-01)', () => {
  it('keeps every row in the order sent with the server figures as numbers, and the total', () => {
    const parsed = parseStaffBalances(staffBalancesFixture());

    expect(parsed.rows.map((row) => [row.name, row.status, row.balance, row.isYou])).toEqual([
      ['Carmen Reyes', 'active', 8450, true],
      ['Liza Mercado', 'active', -500, false],
      ['Paolo Garcia', 'active', 0, false],
      ['Ana Villanueva', 'deleted', -300, false],
      ['Jomar Santos', 'deactivated', 2000, false],
    ]);
    expect(parsed.rows[0]).toMatchObject({ userId: MY_MONEY_USER_ID, role: 'Manager' });
    expect(parsed.total).toBe(9650);
  });

  it('narrows balances and a total that arrive as text, keeping the sign', () => {
    const parsed = parseStaffBalances(
      staffBalancesFixture({ total: '-1200.50', items: [{ ...firstItem(), balance: '-1200.50' }] }),
    );

    expect(parsed.rows[0]?.balance).toBe(-1200.5);
    expect(parsed.total).toBe(-1200.5);
  });

  it('adds nothing: a total that is not the sum of the rows is shown as the server sent it', () => {
    expect(parseStaffBalances(staffBalancesFixture({ total: 1 })).total).toBe(1);
  });

  it.each([
    ['blank text', ''],
    ['words', 'lots'],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('refuses a row balance that is %s, so the tab shows its failure instead of a wrong row', (_what, balance) => {
    expect(() => parseStaffBalances(staffBalancesFixture({ items: [{ ...firstItem(), balance }] }))).toThrow(
      StaffBalancesContractError,
    );
  });

  it('refuses a total that is not a finite number', () => {
    expect(() => parseStaffBalances(staffBalancesFixture({ total: 'many' }))).toThrow(StaffBalancesContractError);
  });

  it('refuses a status the browser does not know, so no row is drawn with a wrong badge', () => {
    expect(() =>
      parseStaffBalances(staffBalancesFixture({ items: [{ ...firstItem(), status: 'suspended' }] })),
    ).toThrow(StaffBalancesContractError);
  });
});

describe('moneyService.transfers (MONEY-03, D-48; plan 10-20)', () => {
  it('calls GET /api/v1/money-transfers?page=2&pageSize=20 and does not send deleted=false', async () => {
    const list = transferListFixture();
    const { fake, service } = serviceWith([{ body: list }]);

    await expect(service.transfers({ page: 2, pageSize: 20, deleted: false })).resolves.toEqual(list);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('GET');
    expect(fake.calls[0]?.url).toBe('/api/v1/money-transfers?page=2&pageSize=20');
  });

  it('sends deleted=true only when a Manager asks for deleted transfers', async () => {
    const { fake, service } = serviceWith([{ body: transferListFixture() }]);

    await service.transfers({ page: 1, pageSize: 50, deleted: true });

    expect(fake.calls[0]?.url).toBe('/api/v1/money-transfers?page=1&pageSize=50&deleted=true');
  });

  it("passes the caller's signal, so cancelling rejects with kind aborted", async () => {
    const { fake, service } = serviceWith([{ hang: true }]);
    const controller = new AbortController();

    const pending = service.transfers({ page: 1, pageSize: 20, deleted: false }, controller.signal).then(
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

describe('moneyService.deleteTransfer (MONEY-06, D-23; plan 10-20)', () => {
  it('calls DELETE /api/v1/money-transfers/{id} with the version as a query parameter', async () => {
    const { fake, service } = serviceWith([{ status: 204 }]);

    await service.deleteTransfer(TRANSFER_ID, 'AAAAAAAAB9E=');

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('DELETE');
    const url = new URL(fake.calls[0]?.url ?? '', 'https://csps.invalid');
    expect(url.pathname).toBe(`/api/v1/money-transfers/${TRANSFER_ID}`);
    expect(url.searchParams.get('version')).toBe('AAAAAAAAB9E=');
  });

  it('encodes a version with "+", "/" and "=" so the server reads the same text back', async () => {
    const { fake, service } = serviceWith([{ status: 204 }]);

    await service.deleteTransfer(TRANSFER_ID, 'a+b/c==');

    const raw = fake.calls[0]?.url ?? '';
    expect(raw).toContain('version=a%2Bb%2Fc%3D%3D');
    expect(new URL(raw, 'https://csps.invalid').searchParams.get('version')).toBe('a+b/c==');
  });

  it('puts no version or id in the body', async () => {
    const { fake, service } = serviceWith([{ status: 204 }]);

    await service.deleteTransfer(TRANSFER_ID, 'AAAAAAAAB9E=');

    expect(fake.calls[0]?.body).toBeNull();
  });
});

describe('moneyService.removeTransfer (MONEY-06, D-24; plan 10-20)', () => {
  it('calls DELETE /api/v1/money-transfers/{id}/permanent with no version and no body', async () => {
    const { fake, service } = serviceWith([{ status: 204 }]);

    await service.removeTransfer(TRANSFER_ID);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('DELETE');
    expect(fake.calls[0]?.url).toBe(`/api/v1/money-transfers/${TRANSFER_ID}/permanent`);
    expect(fake.calls[0]?.body).toBeNull();
  });

  it('encodes the id, so a path-like value can never leave the route', async () => {
    const { fake, service } = serviceWith([{ status: 204 }]);

    await service.removeTransfer('../x');

    expect(fake.calls[0]?.url).toBe('/api/v1/money-transfers/..%2Fx/permanent');
  });
});

describe('parseTransferPage (MONEY-03, wave 5 IN-01; plan 10-20)', () => {
  it('keeps every transfer in the order sent with the server amount as a finite number', () => {
    const parsed = parseTransferPage(
      transferListFixture([transferItemFixture({ amount: 2000 }), transferItemFixture({ amount: 15.5 })], { total: 7 }),
    );

    expect(parsed.rows.map((row) => row.amount)).toEqual([2000, 15.5]);
    expect(parsed.total).toBe(7);
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(20);
  });

  it('carries the people, the date, the note, the version and the deleted facts as sent', () => {
    const [row] = parseTransferPage(transferListFixture([transferDeletedFixture({ note: 'Cash' })])).rows;

    expect(row).toMatchObject({
      id: '0b0f6c1e-0000-4000-8000-0000000000d2',
      version: 'AAAAAAAAB9F=',
      date: '2026-10-06',
      note: 'Cash',
      isDeleted: true,
      deletedAtUtc: '2026-10-08T07:42:00Z',
    });
    expect(row?.from.name).toBe('Paolo Garcia');
    expect(row?.to.name).toBe('Liza Mercado');
    expect(row?.recordedBy?.name).toBe('Carmen Reyes');
    expect(row?.deletedBy?.name).toBe('Carmen Reyes');
  });

  it('reads an amount that arrives as plain decimal text', () => {
    expect(parseTransferPage(transferListFixture([transferItemFixture({ amount: '1250.50' })])).rows[0]?.amount).toBe(
      1250.5,
    );
  });

  it.each([
    ['blank text', ''],
    ['words', 'lots'],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('refuses an amount that is %s, so the tab shows its failure instead of a wrong row', (_what, amount) => {
    expect(() => parseTransferPage(transferListFixture([transferItemFixture({ amount })]))).toThrow(
      TransferContractError,
    );
  });

  it('refuses a total that is not a finite number', () => {
    expect(() => parseTransferPage(transferListFixture([transferItemFixture()], { total: 'many' }))).toThrow(
      TransferContractError,
    );
  });

  it('turns a row into the target a dialog names: id, version, amount, date, both people and the deleted facts', () => {
    const [row] = parseTransferPage(transferListFixture([transferDeletedFixture()])).rows;
    if (row === undefined) throw new Error('No row.');

    expect(toTransferTarget(row)).toEqual({
      id: row.id,
      version: row.version,
      amount: 2000,
      date: '2026-10-06',
      from: row.from,
      to: row.to,
      deletedBy: row.deletedBy,
      deletedAtUtc: '2026-10-08T07:42:00Z',
    });
  });
});
