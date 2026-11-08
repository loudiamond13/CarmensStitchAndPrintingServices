// Staff money calls (MONEY-02, OR-5). Types come from the generated OpenAPI types, never from utils/csps.ts.
// The browser asks only for the caller's own figure; the server answers it from the token, so no id is sent.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';
import { toFiniteFigure } from '@/utils/toFiniteFigure';

type Schemas = components['schemas'];

export type StaffMoneyResponse = Schemas['StaffMoneyResponse'];
export type TransferRecipientResponse = Schemas['TransferRecipientResponse'];
export type CreateTransferRequest = Schemas['CreateMoneyTransferRequest'];
export type TransferSavedResponse = Schemas['MoneyTransferSavedResponse'];

/** The caller's money on hand once the browser has checked the figure: the server's balance as a finite number. */
export interface MyMoney {
  userId: string;
  name: string;
  balance: number;
  today: string;
}

/** The money answer holds a figure the browser cannot trust, so the card shows its failure instead of a wrong balance. */
export class MyMoneyContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MyMoneyContractError';
  }
}

/** Narrows the generated `number | string` balance (wave 5 IN-01). The balance is the server's; nothing is worked out here. */
export function parseMyMoney(response: StaffMoneyResponse): MyMoney {
  const balance = toFiniteFigure(response.balance);
  if (balance === null) throw new MyMoneyContractError('The money on hand is not a finite number.');
  return { userId: response.userId, name: response.name, balance, today: response.today };
}

export type LedgerPageResponse = Schemas['LedgerPageResponse'];
export type LedgerEntryResponse = Schemas['LedgerEntryResponse'];
export type ActorRef = Schemas['ActorRef'];

/** The kinds of row the server sends (GET staff-money/{id}/ledger); any other word is refused, not drawn. */
export type LedgerKind =
  'payment-received' | 'refund-handed-back' | 'transfer-in' | 'transfer-out' | 'company-expense' | 'order-expense';

/** One ledger row once the browser has checked its figures: every amount is the server's, as a finite number or null. */
export interface LedgerRow {
  /** Stable for one page: the kind, the record behind it, when it was recorded and its place on the page. */
  key: string;
  kind: LedgerKind;
  /** The day the money moved, `YYYY-MM-DD`. */
  date: string;
  moneyIn: number | null;
  moneyOut: number | null;
  /** The person's balance after this row; null for a deleted transfer, which counts toward no balance. */
  balanceAfter: number | null;
  orderId: string | null;
  orderNumber: string | null;
  team: string | null;
  customer: string | null;
  paymentMethod: string | null;
  category: string | null;
  description: string | null;
  counterpart: ActorRef | null;
  note: string | null;
  transferId: string | null;
  version: string | null;
  isHandover: boolean;
  recordedBy: ActorRef | null;
  isDeleted: boolean;
  deletedBy: ActorRef | null;
  deletedAtUtc: string | null;
}

/** One server page of a ledger once the browser has checked it. */
export interface LedgerPage {
  rows: LedgerRow[];
  /** How many rows the ledger has across all pages. */
  total: number;
  page: number;
  pageSize: number;
  /** The person's money on hand now, from the server. */
  balance: number;
  includesDeleted: boolean;
}

/** What a ledger read asks for. `deleted` is for a Manager only; the server answers 403 to an Admin who sends it. */
export interface LedgerQuery {
  page: number;
  pageSize: number;
  deleted: boolean;
}

/** The ledger answer holds a figure or a kind the browser cannot trust, so the card shows its failure instead of a wrong row. */
export class LedgerContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LedgerContractError';
  }
}

const LEDGER_KINDS: readonly string[] = [
  'payment-received',
  'refund-handed-back',
  'transfer-in',
  'transfer-out',
  'company-expense',
  'order-expense',
] satisfies readonly LedgerKind[];

function isLedgerKind(kind: string): kind is LedgerKind {
  return LEDGER_KINDS.includes(kind);
}

/** A figure the page needs: a finite number, or the whole answer is refused. */
function requiredFigure(value: unknown, what: string): number {
  const figure = toFiniteFigure(value);
  if (figure === null) throw new LedgerContractError(`The ledger ${what} is not a finite number.`);
  return figure;
}

/** A figure a row may leave out (the empty side, a deleted row's balance): null stays null, anything else must be a finite number. */
function optionalFigure(value: unknown, what: string): number | null {
  return value === null || value === undefined ? null : requiredFigure(value, what);
}

function toLedgerRow(item: LedgerEntryResponse, index: number): LedgerRow {
  if (!isLedgerKind(item.kind)) throw new LedgerContractError(`The ledger row kind "${item.kind}" is not known.`);
  return {
    key: `${String(index)}:${item.kind}:${item.transferId ?? item.orderId ?? ''}:${item.recordedAtUtc}`,
    kind: item.kind,
    date: item.date,
    moneyIn: optionalFigure(item.moneyIn, 'money in'),
    moneyOut: optionalFigure(item.moneyOut, 'money out'),
    balanceAfter: optionalFigure(item.balanceAfter, 'balance'),
    orderId: item.orderId,
    orderNumber: item.orderNumber,
    team: item.team,
    customer: item.customer,
    paymentMethod: item.paymentMethod,
    category: item.category,
    description: item.description,
    counterpart: item.counterpart,
    note: item.note,
    transferId: item.transferId,
    version: item.version,
    isHandover: item.isHandover,
    recordedBy: item.recordedBy,
    isDeleted: item.isDeleted,
    deletedBy: item.deletedBy,
    deletedAtUtc: item.deletedAtUtc,
  };
}

/**
 * Narrows the generated ledger page (figures are `number | string` there). Every amount and balance is the server's; none is worked out
 * here. A figure that is not a plain decimal, or a kind the browser does not know, refuses the whole answer, so no row is drawn wrong.
 */
export function parseLedgerPage(response: LedgerPageResponse): LedgerPage {
  return {
    rows: response.items.map(toLedgerRow),
    total: requiredFigure(response.total, 'total'),
    page: requiredFigure(response.page, 'page'),
    pageSize: requiredFigure(response.pageSize, 'page size'),
    balance: requiredFigure(response.balance, 'balance on hand'),
    includesDeleted: response.includesDeleted,
  };
}

/** The words the server uses for a person's standing; any other word is refused, not shown. */
export type RecipientStatus = 'active' | 'deactivated' | 'deleted';

/** One person the To list offers. There is no figure and no `isYou`: the sender is never offered. */
export interface TransferRecipient {
  id: string;
  name: string;
  status: RecipientStatus;
}

function isRecipientStatus(status: string): status is RecipientStatus {
  return status === 'active' || status === 'deactivated' || status === 'deleted';
}

/** Narrows the generated list (the status is a plain string there): the signed-in person and any unknown status are left out. */
export function toTransferRecipients(list: readonly TransferRecipientResponse[]): TransferRecipient[] {
  const people: TransferRecipient[] = [];
  for (const person of list) {
    if (!person.isYou && isRecipientStatus(person.status)) {
      people.push({ id: person.id, name: person.name, status: person.status });
    }
  }
  return people;
}

export type StaffBalancesResponse = Schemas['StaffBalancesResponse'];
type StaffBalanceRowResponse = Schemas['StaffBalanceRow'];

/** One person's row in All Staff once the browser has checked it: the balance is the server's, as a finite number. */
export interface StaffBalance {
  userId: string;
  name: string;
  /** `Admin` or `Manager`. */
  role: string;
  status: RecipientStatus;
  balance: number;
  /** True for the signed-in Manager. */
  isYou: boolean;
}

/** Everyone's money on hand once the browser has checked it. */
export interface StaffBalances {
  rows: StaffBalance[];
  /** What staff hold together, from the server. */
  total: number;
}

/** The All Staff answer holds a figure or a status the browser cannot trust, so the tab shows its failure instead of a wrong row. */
export class StaffBalancesContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StaffBalancesContractError';
  }
}

function staffFigure(value: unknown, what: string): number {
  const figure = toFiniteFigure(value);
  if (figure === null) throw new StaffBalancesContractError(`The staff ${what} is not a finite number.`);
  return figure;
}

function toStaffBalance(row: StaffBalanceRowResponse): StaffBalance {
  if (!isRecipientStatus(row.status)) {
    throw new StaffBalancesContractError(`The staff status "${row.status}" is not known.`);
  }
  return {
    userId: row.userId,
    name: row.name,
    role: row.role,
    status: row.status,
    balance: staffFigure(row.balance, 'balance'),
    isYou: row.isYou,
  };
}

/**
 * Narrows the generated All Staff answer (figures are `number | string` there). Every balance and the total are the server's; none is
 * worked out here. A figure that is not a plain decimal, or a status the browser does not know, refuses the whole answer.
 */
export function parseStaffBalances(response: StaffBalancesResponse): StaffBalances {
  return { rows: response.items.map(toStaffBalance), total: staffFigure(response.total, 'total') };
}

/** One person's money on hand as a Manager reads it (M2): the same figure as `MyMoney`, with the person's role and standing. */
export interface PersonMoney extends MyMoney {
  /** `Admin` or `Manager`. */
  role: string;
  status: RecipientStatus;
}

/** Narrows the generated answer like `parseMyMoney`, and refuses a standing the browser does not know (no wrong badge is drawn). */
export function parsePersonMoney(response: StaffMoneyResponse): PersonMoney {
  const money = parseMyMoney(response);
  if (!isRecipientStatus(response.status)) {
    throw new MyMoneyContractError(`The standing "${response.status}" is not known.`);
  }
  return { ...money, role: response.role, status: response.status };
}

export interface MoneyService {
  /**
   * `GET /api/v1/staff-money/{userId}`: one person's money on hand with their role and standing, for a Manager (an Admin gets 403 for
   * anyone but themselves). 404 means the person is not staff.
   */
  person(userId: string, signal?: AbortSignal): Promise<StaffMoneyResponse>;
  /**
   * `GET /api/v1/staff-money`: everyone's money on hand, for a Manager only (the server answers 403 to an Admin). Active people by
   * name, then former staff whose balance is not 0.00, each with the server's figure, plus the total held by staff. No parameters.
   */
  staff(signal?: AbortSignal): Promise<StaffBalancesResponse>;
  /**
   * `GET /api/v1/staff-money/me`: the caller's own money on hand, worked out by the server on every read: payments received and
   * transfers in, minus transfers out, expenses paid and refunds handed back. It can be below zero. It takes no parameters.
   */
  me(signal?: AbortSignal): Promise<StaffMoneyResponse>;
  /**
   * `GET /api/v1/money-transfers/recipients`: the people the Transfer Money window may offer in To: active Admins and Managers, then
   * former staff who are owed money, each with a name and a status word and never a figure. The signed-in person is in the list,
   * marked `isYou`. It takes no parameters.
   */
  recipients(signal?: AbortSignal): Promise<TransferRecipientResponse[]>;
  /**
   * `POST /api/v1/money-transfers`: records a transfer from the signed-in person to a coworker (MONEY-04). The body has no sender: the
   * server takes it from the token. The caller supplies one Idempotency-Key per submission, so a double press or a retry records it
   * once. 400 lists the field errors, 409 means another change won, 201 answers the saved transfer and the sender's new balance.
   */
  create(body: CreateTransferRequest, idempotencyKey: string, signal?: AbortSignal): Promise<TransferSavedResponse>;
  /**
   * `GET /api/v1/staff-money/me/ledger` (or `/staff-money/{userId}/ledger` for another person): one page of a person's money rows,
   * newest first, each with the running balance the server worked out after it (MONEY-02, D-41). Page and size are always sent;
   * `deleted=true` only when asked, and only a Manager may (403 for an Admin).
   */
  ledger(userId: string, query: LedgerQuery, signal?: AbortSignal): Promise<LedgerPageResponse>;
}

export function createMoneyService(client: HttpClient): MoneyService {
  return {
    person: (userId, signal) =>
      client.get<StaffMoneyResponse>(`/staff-money/${encodeURIComponent(userId)}`, { signal }),
    staff: (signal) => client.get<StaffBalancesResponse>('/staff-money', { signal }),
    me: (signal) => client.get<StaffMoneyResponse>('/staff-money/me', { signal }),
    recipients: (signal) => client.get<TransferRecipientResponse[]>('/money-transfers/recipients', { signal }),
    create: (body, idempotencyKey, signal) =>
      client.post<TransferSavedResponse>('/money-transfers', body, { idempotencyKey, signal }),
    ledger: (userId, query, signal) =>
      client.get<LedgerPageResponse>(`/staff-money/${encodeURIComponent(userId)}/ledger`, {
        params: { page: query.page, pageSize: query.pageSize, deleted: query.deleted ? true : undefined },
        signal,
      }),
  };
}

export const moneyService: MoneyService = createMoneyService(apiClient);

export default moneyService;
