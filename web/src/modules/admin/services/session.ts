// The staff session in the browser (AUTH-05, plan 04-25). Admin chunk only: public pages never import it (PERF-01).
// The access token lives in this module's memory and nowhere else: never localStorage, sessionStorage, a readable
// cookie or a URL. The refresh token is an HttpOnly cookie the page cannot read.
//   - ensureSession() boots the session once from the refresh cookie (one shared promise, so React StrictMode's double
//     effect sends one request).
//   - The module registers itself with the shared client (configureSession), which sends the Bearer header and calls
//     refreshSession() after a 401.
import { configureSession } from '@/core/api/apiClient';
import { isHttpError } from '@/core/api/errors';
import type { Role } from '@/utils/csps';
import { authService, type AuthService, type SessionResponse } from './authService';

/** The signed-in user as the admin shell shows it. */
export interface SessionUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: Role;
}

export interface SessionSnapshot {
  readonly user: SessionUser | null;
  readonly persistent: boolean;
  /** When the session ends for good (epoch ms), or null without a session. */
  readonly sessionExpiresAt: number | null;
}

export interface SessionDeps {
  readonly auth: Pick<AuthService, 'refresh'>;
}

const signedOut: SessionSnapshot = { user: null, persistent: false, sessionExpiresAt: null };

function toUser(response: SessionResponse): SessionUser {
  const { user } = response;
  return {
    id: user.id,
    email: user.email,
    name: `${user.firstName} ${user.lastName}`.trim(),
    role: user.role === 'Admin' ? 'admin' : 'manager',
  };
}

export function createSession(deps: SessionDeps) {
  let token: string | null = null;
  let snapshot: SessionSnapshot = signedOut;
  const listeners = new Set<() => void>();
  let boot: Promise<SessionUser | null> | undefined;
  let inflight: Promise<void> | undefined;

  function publish(next: SessionSnapshot): void {
    snapshot = next;
    for (const listener of [...listeners]) {
      listener();
    }
  }

  function acceptSession(response: SessionResponse): void {
    token = response.accessToken;
    publish({
      user: toUser(response),
      persistent: response.persistent,
      sessionExpiresAt: Date.parse(response.sessionExpiresAt),
    });
  }

  function clearSession(): void {
    token = null;
    publish(signedOut);
  }

  function refreshSession(): Promise<void> {
    inflight ??= deps.auth
      .refresh()
      .then(acceptSession)
      .finally(() => {
        inflight = undefined;
      });
    return inflight;
  }

  /** The signed-in user, after one refresh from the cookie when this tab has no token yet; null when there is no session. */
  function ensureSession(): Promise<SessionUser | null> {
    if (token !== null) {
      return Promise.resolve(snapshot.user);
    }
    boot ??= refreshSession()
      .then(() => snapshot.user)
      .catch((error: unknown) => {
        if (isHttpError(error)) {
          return null;
        }
        throw error;
      })
      .finally(() => {
        boot = undefined;
      });
    return boot;
  }

  return {
    ensureSession,
    refreshSession,
    acceptSession,
    clearSession,
    accessToken: (): string | null => token,
    getSessionUser: (): SessionUser | null => snapshot.user,
    getSessionSnapshot: (): SessionSnapshot => snapshot,
    subscribeSession: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const session = createSession({ auth: authService });

export const { ensureSession, refreshSession, acceptSession, clearSession, getSessionUser, subscribeSession } = session;
export const { getSessionSnapshot } = session;

configureSession({
  accessToken: session.accessToken,
  refresh: session.refreshSession,
  onUnauthorized: session.clearSession,
});
