// RED stub (plan 10-13): replaced in the GREEN commit.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type StaffMoneyResponse = Schemas['StaffMoneyResponse'];

export interface MyMoney {
  userId: string;
  name: string;
  balance: number;
  today: string;
}

export class MyMoneyContractError extends Error {}

export function parseMyMoney(response: StaffMoneyResponse): MyMoney {
  return { userId: response.userId, name: response.name, balance: 0, today: response.today };
}

export interface MoneyService {
  me(signal?: AbortSignal): Promise<StaffMoneyResponse>;
}

export function createMoneyService(client: HttpClient): MoneyService {
  return { me: () => Promise.resolve({ ...client, userId: '', name: '', balance: 0, today: '' }) };
}

export const moneyService: MoneyService = createMoneyService(apiClient);

export default moneyService;
