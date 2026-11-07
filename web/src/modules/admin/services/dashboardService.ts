// Dashboard calls (DASH-01, OR-5). Types come from the generated OpenAPI types.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type DashboardSummaryResponse = Schemas['DashboardSummaryResponse'];

export interface DashboardService {
  summary(signal?: AbortSignal): Promise<DashboardSummaryResponse>;
}

export function createDashboardService(client: HttpClient): DashboardService {
  void client;
  return { summary: () => Promise.reject(new Error('not built')) };
}

export const dashboardService: DashboardService = createDashboardService(apiClient);
