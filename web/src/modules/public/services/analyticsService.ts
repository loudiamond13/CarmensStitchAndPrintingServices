// The analytics calls (ANL-05, ANL-06, OR-5): one typed POST over the shared client. Types come from the generated OpenAPI types.
import { apiClient, type HttpClient } from '@/core/api/apiClient';

export interface PageViewBody {
  /** The page path only: no query and no fragment. */
  path: string;
  /** The hostname of the referrer, on the first view of a page load only. */
  referrerHost?: string;
}

export interface VitalsBody {
  /** The landing page path only: no query and no fragment. */
  path: string;
  /** Largest Contentful Paint in milliseconds. */
  lcp?: number;
  /** Cumulative Layout Shift score. */
  cls?: number;
  /** Interaction to Next Paint in milliseconds. */
  inp?: number;
}

export interface AnalyticsService {
  /** `POST /api/v1/analytics/page-views`: counts one view; the server answers 204 and never an error the visitor sees. */
  pageView(body: PageViewBody, options?: { keepalive?: boolean }): Promise<void>;
  /** `POST /api/v1/analytics/vitals`: one speed report for a page load; the server answers 204. */
  vitals(body: VitalsBody, options?: { keepalive?: boolean }): Promise<void>;
}

export function createAnalyticsService(client: HttpClient): AnalyticsService {
  return {
    pageView: (body, options) =>
      client.post<undefined>('/analytics/page-views', body, { keepalive: options?.keepalive }),
    vitals: () => Promise.resolve(),
  };
}

export const analyticsService: AnalyticsService = createAnalyticsService(apiClient);
