// Password calls (AUTH-08, AUTH-09, D-16, D-17). Types come from the generated OpenAPI types. Every call here is
// anonymous or carries only a one-time ticket, so a 401 is the answer, never an ended session (skipAuthRefresh).
// Forgot and reset are covered by the Idempotency-Key gate (SEC-06, D-40); the caller supplies one key per submission.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type ForgotPasswordRequest = Schemas['ForgotPasswordRequest'];
export type ResetTokenRequest = Schemas['ResetTokenRequest'];
export type ResetLinkResponse = Schemas['ResetLinkResponse'];
export type ResetPasswordRequest = Schemas['ResetPasswordRequest'];
export type SessionResponse = Schemas['SessionResponse'];
export type SetNewPasswordContext = Schemas['SetNewPasswordContextResponse'];

/** The must-change step's body. Hand-typed until the API contract carries `set-new` (plan 04-21). */
export interface SetNewPasswordRequest {
  readonly newPassword: string;
}

/** The key (and optional cancel signal) of a call the Idempotency-Key gate covers. */
export interface KeyedCall {
  readonly idempotencyKey: string;
  readonly signal?: AbortSignal | undefined;
}

export interface PasswordService {
  /** `POST /api/v1/auth/password/forgot`: 202 for every well-formed address. */
  forgot(body: ForgotPasswordRequest, call: KeyedCall): Promise<void>;
  /** `POST /api/v1/auth/password/reset/check`: the account email behind a usable link, or 404. */
  checkResetLink(body: ResetTokenRequest, signal?: AbortSignal): Promise<ResetLinkResponse>;
  /** `POST /api/v1/auth/password/reset`: saves the new password and ends every session (204). */
  resetPassword(body: ResetPasswordRequest, call: KeyedCall): Promise<void>;
  /** `POST /api/v1/auth/password/set-new/check` (ticket cookie): who the pending sign-in is for and why, or 401. */
  checkSetNewPassword(signal?: AbortSignal): Promise<SetNewPasswordContext>;
  /** `POST /api/v1/auth/password/set-new` (ticket cookie): saves the must-change password and starts the session. */
  setNewPassword(body: SetNewPasswordRequest, signal?: AbortSignal): Promise<SessionResponse>;
}

export function createPasswordService(client: HttpClient): PasswordService {
  return {
    forgot: (body, { idempotencyKey, signal }) =>
      client.post('/auth/password/forgot', body, { idempotencyKey, signal, skipAuthRefresh: true }),
    checkResetLink: (body, signal) =>
      client.post('/auth/password/reset/check', body, { signal, skipAuthRefresh: true }),
    resetPassword: (body, { idempotencyKey, signal }) =>
      client.post('/auth/password/reset', body, { idempotencyKey, signal, skipAuthRefresh: true }),
    checkSetNewPassword: (signal) =>
      client.post('/auth/password/set-new/check', undefined, { signal, skipAuthRefresh: true }),
    setNewPassword: (body, signal) => client.post('/auth/password/set-new', body, { signal, skipAuthRefresh: true }),
  };
}

export const passwordService: PasswordService = createPasswordService(apiClient);
