// The one shared HTTP client for module services (WEB-04), same-origin under /api/v1.
// Every request sends X-CSPS-CSRF: 1 (AUTH-05). The admin session module plugs in through configureSession: it supplies
// the Bearer token, the refresh that follows a 401 and the sign-out when a 401 cannot be recovered. core/api imports
// nothing from modules/, so the public bundle never carries the session code.
import { createHttpClient, type HttpClient } from './http/httpClient';

export { createHttpClient, type HttpClient } from './http/httpClient';

export interface SessionHooks {
  /** The current access token, or null when there is no session. */
  accessToken(): string | null;
  /** Renews the session; a rejection means the session is over. */
  refresh(): Promise<void>;
  /** Called once when a 401 cannot be recovered. */
  onUnauthorized(): void;
}

let hooks: SessionHooks | undefined;

/** Sets the session hooks. A later call replaces the earlier one. */
export function configureSession(next: SessionHooks): void {
  hooks = next;
}

export const apiClient: HttpClient = createHttpClient({
  baseURL: '/api/v1',
  headers: { 'X-CSPS-CSRF': '1' },
  refresh: () => (hooks === undefined ? Promise.reject(new Error('No session is configured.')) : hooks.refresh()),
  onUnauthorized: () => {
    hooks?.onUnauthorized();
  },
});

apiClient.interceptors.request.use((request) => {
  const token = hooks?.accessToken();
  if (token !== null && token !== undefined) {
    request.headers.set('Authorization', `Bearer ${token}`);
  }
  return request;
});
