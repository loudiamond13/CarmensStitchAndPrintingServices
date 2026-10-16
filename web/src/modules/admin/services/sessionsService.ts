// Signed-in devices calls (AUTH-06, D-43). Types come from the generated OpenAPI types (D-16). The list is the caller's own
// active sessions; the server refuses to end the current one and answers 404 for an id that is not the caller's.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type SessionListItem = Schemas['SessionListItem'];
export type RevokeSessionResponse = Schemas['RevokeSessionResponse'];

export interface SessionsService {
  /** `GET /api/v1/sessions`: this device first, then the rest by recent activity, at most 100. */
  list(signal?: AbortSignal): Promise<SessionListItem[]>;
  /** `DELETE /api/v1/sessions/{id}`: signs one other device out; `alreadySignedOut` when it had already ended. */
  revoke(id: string, signal?: AbortSignal): Promise<RevokeSessionResponse>;
}

export function createSessionsService(client: HttpClient): SessionsService {
  return {
    list: (signal) => client.get<SessionListItem[]>('/sessions', { signal }),
    revoke: (id, signal) => client.delete<RevokeSessionResponse>(`/sessions/${encodeURIComponent(id)}`, { signal }),
  };
}

export const sessionsService: SessionsService = createSessionsService(apiClient);
