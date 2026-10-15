// A SessionResponse for tests: Carmen Reyes, Manager, with an access token that expires 15 minutes from `now`.
import type { components } from '@/types/api.generated';

export type SessionResponse = components['schemas']['SessionResponse'];

export function sessionResponse(overrides: Partial<SessionResponse> = {}, now: number = Date.now()): SessionResponse {
  return {
    accessToken: 'access-token-1',
    accessTokenExpiresAt: new Date(now + 15 * 60_000).toISOString(),
    sessionExpiresAt: new Date(now + 12 * 3_600_000).toISOString(),
    persistent: false,
    user: {
      id: '5f0c4a1e-8c1d-4a52-9d0e-1a2b3c4d5e6f',
      email: 'carmen@example.ph',
      firstName: 'Carmen',
      lastName: 'Reyes',
      role: 'Manager',
    },
    ...overrides,
  };
}
