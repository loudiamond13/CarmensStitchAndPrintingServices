// Dashboard calls (DASH-01, OR-5). Types come from the generated OpenAPI types, never from utils/csps.ts.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type DashboardSummaryResponse = Schemas['DashboardSummaryResponse'];

export interface DashboardService {
  /**
   * `GET /api/v1/dashboard/summary`: the business today, the greeting part, the caller's first name, the four card figures, the
   * six status counts and the six newest orders in one live answer. It takes no parameters and the server never caches it.
   */
  summary(signal?: AbortSignal): Promise<DashboardSummaryResponse>;
}

export function createDashboardService(client: HttpClient): DashboardService {
  return {
    summary: (signal) => client.get<DashboardSummaryResponse>('/dashboard/summary', { signal }),
  };
}

export const dashboardService: DashboardService = createDashboardService(apiClient);
