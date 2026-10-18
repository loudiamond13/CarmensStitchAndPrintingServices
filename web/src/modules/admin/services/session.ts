// The staff session in the browser (AUTH-05, AUTH-06, R2-09; plan 04-25). Admin chunk only: public pages never import it
// (PERF-01). The access token lives in this module's memory and nowhere else: never localStorage, sessionStorage, a
// readable cookie, a URL or a channel message. The refresh token is an HttpOnly cookie the page cannot read.
//   - ensureSession() boots the session once from the refresh cookie (one shared promise, so React StrictMode's double
//     effect sends one request).
//   - The module registers itself with the shared client (configureSession), which sends the Bearer header and calls
//     refreshSession() after a 401.
//   - Refreshes are single flight in a tab (one promise) and across tabs (Web Locks 'csps-refresh', where available).
//     BroadcastChannel('csps-auth') carries only "refreshed" (with the new expiry) and "signed-out".
import { configureSession } from '@/core/api/apiClient';
import { HttpError, isHttpError } from '@/core/api/errors';
import { setCacheOwner } from '@/lib/query/cacheOwner';
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

/** The one-shot message the sign-in page shows once (UI-SPEC "One-shot notices"). Never put in a URL or storage. */
export type SignInNotice = 'session-ended' | 'signed-out' | 'password-changed' | 'password-set' | 'timed-out';

/** The one-shot toast the admin shell shows once after a sign-in that came from a screen of the auth layout. */
export type SignedInToast = 'password-saved';

/** The part of navigator.locks the session uses. */
export interface LockManagerLike {
  request(name: string, callback: () => Promise<void>): Promise<void>;
}

/** The part of BroadcastChannel the session uses. */
export interface ChannelLike {
  postMessage(message: unknown): void;
  listen(handler: (data: unknown) => void): void;
}

export interface SessionDeps {
  readonly auth: Pick<AuthService, 'refresh' | 'signOut'>;
  /** Defaults to navigator.locks; null means none (tabs then rely on the server's grace window). */
  readonly locks?: LockManagerLike | null | undefined;
  /** Defaults to BroadcastChannel('csps-auth'). */
  readonly createChannel?: ((name: string) => ChannelLike | undefined) | undefined;
  /** Waits before the one retry of a busy refresh. */
  readonly sleep?: ((ms: number) => Promise<void>) | undefined;
  readonly now?: (() => number) | undefined;
}

const LOCK_NAME = 'csps-refresh';
const CHANNEL_NAME = 'csps-auth';
const LOGIN_PATH = '/admin/login';
/** A token with more than this left is fresh enough to skip a refresh a peer tab just did. */
const FRESH_MARGIN_MS = 60_000;
/** The wait before the one retry of a refresh that lost a save race (409 auth.session-busy). */
const BUSY_RETRY_MS = 250;

const signedOut: SessionSnapshot = { user: null, persistent: false, sessionExpiresAt: null };

type ChannelMessage = { readonly type: 'signed-out' } | { readonly type: 'refreshed'; readonly expiresAt: number };

function toMessage(data: unknown): ChannelMessage | null {
  if (typeof data !== 'object' || data === null || !('type' in data)) {
    return null;
  }
  if (data.type === 'signed-out') {
    return { type: 'signed-out' };
  }
  if (data.type === 'refreshed' && 'expiresAt' in data && typeof data.expiresAt === 'number') {
    return { type: 'refreshed', expiresAt: data.expiresAt };
  }
  return null;
}

/** The two server roles the shell knows, matched exactly. Anything else is not a role (IN-17). */
function toRole(role: string | undefined): Role | null {
  if (role === 'Admin') {
    return 'admin';
  }
  return role === 'Manager' ? 'manager' : null;
}

/** The shell's user, or null when the server role is not exactly Admin or Manager. */
function toUser(response: SessionResponse): SessionUser | null {
  const { user } = response;
  const role = toRole(user.role);
  if (role === null) {
    return null;
  }
  return { id: user.id, email: user.email, name: `${user.firstName} ${user.lastName}`.trim(), role };
}

function browserLocks(): LockManagerLike | null {
  return typeof navigator !== 'undefined' && 'locks' in navigator
    ? { request: (name, callback) => navigator.locks.request(name, callback) }
    : null;
}

function browserChannel(name: string): ChannelLike | undefined {
  if (typeof BroadcastChannel === 'undefined') {
    return undefined;
  }
  const channel = new BroadcastChannel(name);
  return {
    postMessage: (message) => {
      channel.postMessage(message);
    },
    listen: (handler) => {
      channel.addEventListener('message', (event: MessageEvent) => {
        handler(event.data);
      });
    },
  };
}

export function createSession(deps: SessionDeps) {
  const locks = deps.locks === undefined ? browserLocks() : deps.locks;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = deps.now ?? Date.now;
  const channel = (deps.createChannel ?? browserChannel)(CHANNEL_NAME);

  let token: string | null = null;
  let tokenExpiresAt = 0;
  let snapshot: SessionSnapshot = signedOut;
  const listeners = new Set<() => void>();
  let boot: Promise<SessionUser | null> | undefined;
  let inflight: Promise<void> | undefined;
  let routerNavigate: ((to: string) => void) | undefined;
  let notice: SignInNotice | null = null;
  let signedInToast: SignedInToast | null = null;
  let pendingEmail: string | null = null;
  let resendAvailableAt: number | null = null;
  /** How the last refresh failed: only a 401 means the session is over. */
  let refreshFailure: 'unauthorized' | 'other' | null = null;
  let peerRefreshes = 0;
  let peerExpiresAt = 0;

  function publish(next: SessionSnapshot): void {
    snapshot = next;
    for (const listener of [...listeners]) {
      listener();
    }
  }

  function acceptSession(response: SessionResponse): void {
    const user = toUser(response);
    if (user === null) {
      // An unknown role is never guessed at: the response is refused and nothing of the session is kept.
      clearSession();
      return;
    }
    token = response.accessToken;
    tokenExpiresAt = Date.parse(response.accessTokenExpiresAt);
    pendingEmail = null;
    publish({
      user,
      persistent: response.persistent,
      sessionExpiresAt: Date.parse(response.sessionExpiresAt),
    });
  }

  function clearSession(): void {
    token = null;
    tokenExpiresAt = 0;
    pendingEmail = null;
    resendAvailableAt = null;
    publish(signedOut);
  }

  /** A correct code issued a session: keep it, drop the code step state and tell other tabs one exists (no token). */
  function completeSignIn(response: SessionResponse): void {
    acceptSession(response);
    resendAvailableAt = null;
    if (snapshot.user === null) {
      return;
    }
    channel?.postMessage({ type: 'refreshed', expiresAt: tokenExpiresAt } satisfies ChannelMessage);
  }

  /** Clears this tab's session, leaves the one-shot notice for the sign-in page and goes there. */
  function endSession(reason: SignInNotice, goToSignIn: boolean): void {
    clearSession();
    notice = reason;
    if (goToSignIn) {
      routerNavigate?.(LOGIN_PATH);
    }
  }

  /** One refresh request; a 409 (lost a save race, the cookie is kept) is tried once more. */
  async function requestSession(): Promise<void> {
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await deps.auth.refresh();
        acceptSession(response);
        if (snapshot.user === null) {
          // A refused role ends the session the same way a refresh 401 does.
          throw new HttpError({ kind: 'http', status: 401 });
        }
        channel?.postMessage({ type: 'refreshed', expiresAt: tokenExpiresAt } satisfies ChannelMessage);
        return;
      } catch (error) {
        if (attempt === 0 && isHttpError(error) && error.status === 409) {
          await sleep(BUSY_RETRY_MS);
          continue;
        }
        refreshFailure = isHttpError(error) && error.status === 401 ? 'unauthorized' : 'other';
        throw error;
      }
    }
  }

  /** Inside the lock: a peer tab just refreshed and this tab's own token is still fresh, so there is nothing to do. */
  async function refreshUnderLock(peersBefore: number): Promise<void> {
    const peerRefreshed = peerRefreshes > peersBefore && peerExpiresAt - now() > FRESH_MARGIN_MS;
    if (peerRefreshed && token !== null && tokenExpiresAt - now() > FRESH_MARGIN_MS) {
      return;
    }
    await requestSession();
  }

  function refreshSession(): Promise<void> {
    inflight ??= (async () => {
      // A failure from an earlier refresh must not outlive it, whichever path this refresh takes.
      refreshFailure = null;
      const peersBefore = peerRefreshes;
      if (locks === null) {
        await refreshUnderLock(peersBefore);
      } else {
        await locks.request(LOCK_NAME, () => refreshUnderLock(peersBefore));
      }
    })().finally(() => {
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
        // Only a 401 means "no session". An outage, a timeout or a rate limit may hit a person whose cookie is fine, so
        // it surfaces to the retryable error screen instead of sending them to a sign-in that cannot work.
        if (isHttpError(error) && error.status === 401) {
          return null;
        }
        throw error;
      })
      .finally(() => {
        boot = undefined;
      });
    return boot;
  }

  /**
   * Signs out on the server (a 409 save race is tried once more). True only when the server ended the session: then
   * this tab's session ends, other tabs are told and the notice is set. False leaves everything as it was, so the
   * person stays signed in and can try again.
   */
  async function signOut(): Promise<boolean> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await deps.auth.signOut();
        endSession('signed-out', false);
        channel?.postMessage({ type: 'signed-out' } satisfies ChannelMessage);
        return true;
      } catch (error) {
        if (attempt === 0 && isHttpError(error) && error.status === 409) {
          await sleep(BUSY_RETRY_MS);
          continue;
        }
        return false;
      }
    }
    return false;
  }

  /** The shared client gave up on a 401: the session is over, unless the refresh failed for another reason. */
  function handleUnauthorized(): void {
    if (refreshFailure === 'other') {
      return;
    }
    endSession('session-ended', true);
  }

  channel?.listen((data) => {
    const message = toMessage(data);
    if (message?.type === 'refreshed') {
      peerRefreshes += 1;
      peerExpiresAt = message.expiresAt;
    } else if (message?.type === 'signed-out' && token !== null) {
      endSession('session-ended', true);
    }
  });

  return {
    ensureSession,
    refreshSession,
    acceptSession,
    completeSignIn,
    clearSession,
    signOut,
    handleUnauthorized,
    accessToken: (): string | null => token,
    getSessionUser: (): SessionUser | null => snapshot.user,
    getSessionSnapshot: (): SessionSnapshot => snapshot,
    subscribeSession: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** The router's navigate function; session.ts never imports the router. */
    setNavigator: (next: (to: string) => void): void => {
      routerNavigate = next;
    },
    setSignInNotice: (next: SignInNotice): void => {
      notice = next;
    },
    /** The notice once, then null. */
    takeSignInNotice: (): SignInNotice | null => {
      const taken = notice;
      notice = null;
      return taken;
    },
    /** Leaves a toast for the admin shell: the auth layout's own toast layer goes away with its route. */
    setSignedInToast: (next: SignedInToast): void => {
      signedInToast = next;
    },
    /** The toast once, then null. */
    takeSignedInToast: (): SignedInToast | null => {
      const taken = signedInToast;
      signedInToast = null;
      return taken;
    },
    setPendingEmail: (email: string): void => {
      pendingEmail = email;
    },
    getPendingEmail: (): string | null => pendingEmail,
    /** When the next code may be asked for (epoch ms), set by sign-in and by each resend. Memory only. */
    setResendAvailableAt: (at: number): void => {
      resendAvailableAt = at;
    },
    getResendAvailableAt: (): number | null => resendAvailableAt,
  };
}

const session = createSession({ auth: authService });

export const {
  ensureSession,
  refreshSession,
  acceptSession,
  completeSignIn,
  clearSession,
  signOut,
  getSessionUser,
  getSessionSnapshot,
  subscribeSession,
  setNavigator,
  setSignInNotice,
  takeSignInNotice,
  setSignedInToast,
  takeSignedInToast,
  setPendingEmail,
  getPendingEmail,
  setResendAvailableAt,
  getResendAvailableAt,
} = session;

// The query cache follows the signed-in person for as long as the app runs, whichever routes are mounted.
session.subscribeSession(() => {
  setCacheOwner(session.getSessionUser()?.id ?? null);
});

configureSession({
  accessToken: session.accessToken,
  refresh: session.refreshSession,
  onUnauthorized: session.handleUnauthorized,
});
