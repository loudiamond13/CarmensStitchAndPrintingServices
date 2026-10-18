// Authentication calls (AUTH-01 to AUTH-06). Types come from the generated OpenAPI types (D-16). The calls that carry the
// credentials, the code or the refresh cookie pass skipAuthRefresh: a 401 there is the answer, not an ended session.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type SignInRequest = Schemas['SignInRequest'];
export type VerifyCodeRequest = Schemas['VerifyCodeRequest'];
export type VerifyCodeResponse = Schemas['VerifyCodeResponse'];
export type ResendWaitResponse = Schemas['ResendWaitResponse'];
export type SessionResponse = Schemas['SessionResponse'];

export interface AuthService {
  /** `POST /api/v1/auth/sign-in`: checks the password and sends the code. */
  signIn(body: SignInRequest, signal?: AbortSignal): Promise<ResendWaitResponse>;
  /** `POST /api/v1/auth/two-factor/verify`. */
  verifyCode(body: VerifyCodeRequest, signal?: AbortSignal): Promise<VerifyCodeResponse>;
  /** `POST /api/v1/auth/two-factor/resend`. */
  resendCode(signal?: AbortSignal): Promise<ResendWaitResponse>;
  /** `POST /api/v1/auth/refresh`: the refresh cookie in, a new session out. */
  refresh(signal?: AbortSignal): Promise<SessionResponse>;
  /** `POST /api/v1/auth/sign-out`: ends this device's session. */
  signOut(signal?: AbortSignal): Promise<void>;
  /** `POST /api/v1/auth/sign-out-others` (Bearer): ends every other session. */
  signOutOthers(signal?: AbortSignal): Promise<void>;
}

export function createAuthService(client: HttpClient): AuthService {
  return {
    signIn: (body, signal) => client.post('/auth/sign-in', body, { signal, skipAuthRefresh: true }),
    verifyCode: (body, signal) => client.post('/auth/two-factor/verify', body, { signal, skipAuthRefresh: true }),
    resendCode: (signal) => client.post('/auth/two-factor/resend', undefined, { signal, skipAuthRefresh: true }),
    refresh: (signal) => client.post('/auth/refresh', undefined, { signal, skipAuthRefresh: true }),
    signOut: (signal) => client.post('/auth/sign-out', undefined, { signal, skipAuthRefresh: true }),
    signOutOthers: (signal) => client.post('/auth/sign-out-others', undefined, { signal }),
  };
}

export const authService: AuthService = createAuthService(apiClient);
