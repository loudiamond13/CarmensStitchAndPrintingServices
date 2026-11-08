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

export interface MoneyService {
  /**
   * `GET /api/v1/staff-money/me`: the caller's own money on hand, worked out by the server on every read: payments received and
   * transfers in, minus transfers out, expenses paid and refunds handed back. It can be below zero. It takes no parameters.
   */
  me(signal?: AbortSignal): Promise<StaffMoneyResponse>;
  /** RED stub. */
  recipients(signal?: AbortSignal): Promise<TransferRecipientResponse[]>;
  /** RED stub. */
  create(body: CreateTransferRequest, idempotencyKey: string, signal?: AbortSignal): Promise<TransferSavedResponse>;
}

export function createMoneyService(client: HttpClient): MoneyService {
  return {
    me: (signal) => client.get<StaffMoneyResponse>('/staff-money/me', { signal }),
    recipients: () => Promise.resolve([]),
    create: () => Promise.reject(new Error('RED stub')),
  };
}

export const moneyService: MoneyService = createMoneyService(apiClient);

export default moneyService;
