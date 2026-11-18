// RED stub (plan 12-23): the call is built in the GREEN commit.
import type { HttpClient } from '@/core/api/apiClient';
import { apiClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

export type VisitorStatsResponse = components['schemas']['VisitorStatsResponse'];

export interface VisitorStatsQuery {
  range: string;
  from: string | null;
  to: string | null;
}

export interface VisitorStats {
  range: string;
  from: string;
  to: string;
  cutDate: string;
  totals: { uniqueVisitors: number | null; visits: number | null; pageViews: number; countedFrom: string | null };
}

export class VisitorStatsContractError extends Error {}

export interface VisitorStatsService {
  get(query: VisitorStatsQuery, signal?: AbortSignal): Promise<VisitorStats>;
}

export function createVisitorStatsService(client: HttpClient): VisitorStatsService {
  void client;
  return { get: () => Promise.reject(new Error('Not built yet.')) };
}

export const visitorStatsService: VisitorStatsService = createVisitorStatsService(apiClient);
