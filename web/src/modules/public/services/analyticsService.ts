// The analytics calls (ANL-06, OR-5): one typed POST over the shared client. The body is the page path and nothing else (D-53).
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import { isPageViewPath } from '@/utils/pageViewPath';

export interface PageViewBody {
  /** The page path only: no query and no fragment. */
  path: string;
}

export interface AnalyticsService {
  /**
   * `POST /api/v1/analytics/page-views`: counts one view; the server answers 204 and never an error the visitor sees. A path the
   * server would refuse sends nothing (OR-3).
   */
  pageView(body: PageViewBody): Promise<void>;
}

export function createAnalyticsService(client: HttpClient): AnalyticsService {
  return {
    pageView: (body) =>
      isPageViewPath(body.path) ? client.post<undefined>('/analytics/page-views', body) : Promise.resolve(),
  };
}

export const analyticsService: AnalyticsService = createAnalyticsService(apiClient);
