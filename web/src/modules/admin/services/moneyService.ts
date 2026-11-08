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

export interface MoneyService {
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
}

export function createMoneyService(client: HttpClient): MoneyService {
  return {
    me: (signal) => client.get<StaffMoneyResponse>('/staff-money/me', { signal }),
    recipients: (signal) => client.get<TransferRecipientResponse[]>('/money-transfers/recipients', { signal }),
    create: (body, idempotencyKey, signal) =>
      client.post<TransferSavedResponse>('/money-transfers', body, { idempotencyKey, signal }),
  };
}

export const moneyService: MoneyService = createMoneyService(apiClient);

export default moneyService;
