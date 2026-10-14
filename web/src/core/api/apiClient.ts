// The one shared HTTP client for module services (WEB-04), same-origin under /api/v1. Phase 4 adds the session refresh
// and the sign-out on 401 here.
import { createHttpClient, type HttpClient } from './http/httpClient';

export { createHttpClient, type HttpClient } from './http/httpClient';

export const apiClient: HttpClient = createHttpClient({ baseURL: '/api/v1' });
