// The staff session (AUTH-05, AUTH-06, R2-09, D-09; plan 04-25): single-flight refresh across tabs, sign-out, one-shot
// notices, the pending email and the wiring to the shared client.
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/core/api/apiClient';
import { HttpError } from '@/core/api/errors';
import { createDeferred, type Deferred } from '@/test/fakeFetch';
import { server } from '@/test/msw';
import { sessionResponse, type SessionResponse } from '@/test/sessionFixtures';
import {
  acceptSession,
  clearSession,
  createSession,
  completeSignIn,
  ensureSession,
  getPendingEmail,
  getResendAvailableAt,
  getSessionUser,
  refreshSession,
  setNavigator,
  setPendingEmail,
  setResendAvailableAt,
  setSignInNotice,
  signOut,
  takeSignInNotice,
  setSignedInToast,
  takeSignedInToast,
} from './session';

/** An in-memory BroadcastChannel hub: a message reaches every other channel of the hub, one microtask later. */
function createHub() {
  type Handler = (data: unknown) => void;
  const channels: { handler: Handler | null }[] = [];
  const messages: unknown[] = [];
  return {
    messages,
    create(): { postMessage(message: unknown): void; listen(handler: Handler): void } {
      const channel: { handler: Handler | null } = { handler: null };
      channels.push(channel);
      return {
        postMessage(message: unknown) {
          messages.push(message);
          for (const other of channels.filter((candidate) => candidate !== channel)) {
            queueMicrotask(() => {
              other.handler?.(structuredClone(message));
            });
          }
        },
        listen(handler: Handler) {
          channel.handler = handler;
        },
      };
    },
  };
}

/** A fake navigator.locks: one holder at a time per name, in request order. */
function createLocks() {
  let tail: Promise<unknown> = Promise.resolve();
  const state = { holders: 0, maxHolders: 0 };
  return {
    state,
    request<T>(_name: string, callback: () => Promise<T>): Promise<T> {
      const run = tail.then(async () => {
        state.holders += 1;
        state.maxHolders = Math.max(state.maxHolders, state.holders);
        try {
          return await callback();
        } finally {
          state.holders -= 1;
        }
      });
      tail = run.catch(() => undefined);
      return run;
    },
  };
}

type Locks = ReturnType<typeof createLocks>;
type Hub = ReturnType<typeof createHub>;

function newTab(hub: Hub, locks: Locks | null) {
  const answers: Deferred<SessionResponse>[] = [];
  const refresh = vi.fn(() => {
    const next = createDeferred<SessionResponse>();
    answers.push(next);
    return next.promise;
  });
  const signOutCall = vi.fn(() => Promise.resolve());
  const navigate = vi.fn();
  const tab = createSession({
    auth: { refresh, signOut: signOutCall },
    locks,
    createChannel: () => hub.create(),
    sleep: () => Promise.resolve(),
  });
  tab.setNavigator(navigate);
  return {
    tab,
    refresh,
    signOutCall,
    navigate,
    /** Answers the refresh call that is waiting (the latest one), once it has been made. */
    async answer(response: SessionResponse): Promise<void> {
      await vi.waitFor(() => {
        expect(answers.length).toBeGreaterThan(0);
      });
      answers.at(-1)?.resolve(response);
    },
  };
}

/** A session response whose user carries `role` exactly as given, or no role at all when it is undefined. */
function responseWithRole(role: string | undefined): SessionResponse {
  const user: Partial<SessionResponse['user']> = { ...sessionResponse().user };
  if (role !== undefined) {
    user.role = role;
  } else {
    delete user.role;
  }
  return sessionResponse({ user: user as SessionResponse['user'] });
}

describe('the role mapping fails closed (IN-17, USER-08)', () => {
  it.each([
    ['Admin', 'admin'],
    ['Manager', 'manager'],
  ])('maps the server role %s to %s', async (role, expected) => {
    const a = newTab(createHub(), createLocks());

    const user = a.tab.ensureSession();
    await a.answer(responseWithRole(role));

    await expect(user).resolves.toMatchObject({ role: expected });
  });

  it.each([
    ['another casing (manager)', 'manager'],
    ['another casing (MANAGER)', 'MANAGER'],
    ['another casing (admin)', 'admin'],
    ['a trailing space', 'Manager '],
    ['a role the app does not know', 'Owner'],
    ['an empty role', ''],
    ['a missing role', undefined],
  ])('%s ends the session as signed out instead of becoming Manager', async (_name, role) => {
    const a = newTab(createHub(), createLocks());

    const user = a.tab.ensureSession();
    await a.answer(responseWithRole(role));

    await expect(user).resolves.toBeNull();
    expect(a.tab.getSessionUser()).toBeNull();
    expect(a.tab.accessToken()).toBeNull();
  });

  it('tells no other tab that a session was refreshed when the role is refused', async () => {
    const hub = createHub();
    const a = newTab(hub, createLocks());

    const user = a.tab.ensureSession();
    await a.answer(responseWithRole('Owner'));
    await user;

    expect(hub.messages).toEqual([]);
  });

  it('drops a live session when a later response brings an unknown role', () => {
    const a = newTab(createHub(), createLocks());
    a.tab.acceptSession(sessionResponse());

    a.tab.acceptSession(responseWithRole('Owner'));

    expect(a.tab.getSessionUser()).toBeNull();
    expect(a.tab.accessToken()).toBeNull();
  });
});

describe('refreshSession single flight', () => {
  it('two concurrent calls in one tab send one request', async () => {
    const a = newTab(createHub(), createLocks());

    const first = a.tab.refreshSession();
    const second = a.tab.refreshSession();
    await a.answer(sessionResponse());
    await Promise.all([first, second]);

    expect(a.refresh).toHaveBeenCalledTimes(1);
    expect(a.tab.getSessionUser()?.name).toBe('Carmen Reyes');
  });

  it('still holds without navigator.locks', async () => {
    const a = newTab(createHub(), null);

    const calls = Promise.all([a.tab.refreshSession(), a.tab.refreshSession(), a.tab.refreshSession()]);
    await a.answer(sessionResponse());
    await calls;

    expect(a.refresh).toHaveBeenCalledTimes(1);
  });

  it('ensureSession twice (StrictMode) sends one refresh and the later call finds the session', async () => {
    const a = newTab(createHub(), createLocks());

    const first = a.tab.ensureSession();
    const second = a.tab.ensureSession();
    await a.answer(sessionResponse());
    const [one, two] = await Promise.all([first, second]);

    expect(a.refresh).toHaveBeenCalledTimes(1);
    expect(one).toBe(two);
    await expect(a.tab.ensureSession()).resolves.toBe(one);
    expect(a.refresh).toHaveBeenCalledTimes(1);
  });

  it('two tabs with expired tokens refresh one after the other, never together', async () => {
    const hub = createHub();
    const locks = createLocks();
    const a = newTab(hub, locks);
    const b = newTab(hub, locks);

    const refreshedA = a.tab.refreshSession();
    const refreshedB = b.tab.refreshSession();
    await vi.waitFor(() => {
      expect(a.refresh).toHaveBeenCalledTimes(1);
    });
    expect(b.refresh).not.toHaveBeenCalled();

    await a.answer(sessionResponse({ accessToken: 'token-a' }));
    await refreshedA;
    await vi.waitFor(() => {
      expect(b.refresh).toHaveBeenCalledTimes(1);
    });
    await b.answer(sessionResponse({ accessToken: 'token-b' }));
    await refreshedB;

    expect(locks.state.maxHolders).toBe(1);
    expect(a.tab.accessToken()).toBe('token-a');
    expect(b.tab.accessToken()).toBe('token-b');
  });

  it('a tab whose own token is still fresh skips its request when a peer refreshed while it waited', async () => {
    const hub = createHub();
    const locks = createLocks();
    const a = newTab(hub, locks);
    const b = newTab(hub, locks);
    b.tab.acceptSession(sessionResponse({ accessToken: 'token-b' }));

    const refreshedA = a.tab.refreshSession();
    const refreshedB = b.tab.refreshSession();
    await a.answer(sessionResponse({ accessToken: 'token-a' }));
    await Promise.all([refreshedA, refreshedB]);

    expect(b.refresh).not.toHaveBeenCalled();
    expect(b.tab.accessToken()).toBe('token-b');
  });

  it('a tab whose own token is nearly expired still refreshes after a peer did', async () => {
    const hub = createHub();
    const locks = createLocks();
    const a = newTab(hub, locks);
    const b = newTab(hub, locks);
    b.tab.acceptSession(
      sessionResponse({ accessToken: 'token-b', accessTokenExpiresAt: new Date(Date.now() + 5_000).toISOString() }),
    );

    const refreshedA = a.tab.refreshSession();
    const refreshedB = b.tab.refreshSession();
    await a.answer(sessionResponse({ accessToken: 'token-a' }));
    await refreshedA;
    await b.answer(sessionResponse({ accessToken: 'token-b2' }));
    await refreshedB;

    expect(b.refresh).toHaveBeenCalledTimes(1);
    expect(b.tab.accessToken()).toBe('token-b2');
  });

  it('announces a refresh with the expiry only: no token, no email, no name', async () => {
    const hub = createHub();
    const a = newTab(hub, createLocks());

    const pending = a.tab.refreshSession();
    await a.answer(sessionResponse());
    await pending;

    const text = JSON.stringify(hub.messages);
    expect(hub.messages).toEqual([{ type: 'refreshed', expiresAt: expect.any(Number) as number }]);
    expect(text).not.toContain('access-token');
    expect(text).not.toContain('carmen@example.ph');
    expect(text).not.toContain('Carmen');
  });
});

describe('sign-out and other tabs (AUTH-06, R2-09)', () => {
  it('signOut posts to the server, clears the session, tells other tabs, sets the signed-out notice and resolves true', async () => {
    const hub = createHub();
    const a = newTab(hub, createLocks());
    a.tab.acceptSession(sessionResponse());
    hub.messages.length = 0;

    await expect(a.tab.signOut()).resolves.toBe(true);

    expect(a.signOutCall).toHaveBeenCalledTimes(1);
    expect(a.tab.getSessionUser()).toBeNull();
    expect(a.tab.accessToken()).toBeNull();
    expect(hub.messages).toEqual([{ type: 'signed-out' }]);
    expect(a.tab.takeSignInNotice()).toBe('signed-out');
  });

  it.each([
    ['a network failure', new HttpError({ kind: 'network' })],
    ['a timeout', new HttpError({ kind: 'timeout' })],
    ['a 403', new HttpError({ kind: 'http', status: 403 })],
    ['a 429', new HttpError({ kind: 'http', status: 429 })],
    ['a 500', new HttpError({ kind: 'http', status: 500 })],
    ['a 503', new HttpError({ kind: 'http', status: 503 })],
  ])(
    'signOut after %s resolves false and leaves the session, the channel and the notice alone',
    async (_name, failure) => {
      const hub = createHub();
      const a = newTab(hub, createLocks());
      a.signOutCall.mockRejectedValue(failure);
      a.tab.acceptSession(sessionResponse());
      const user = a.tab.getSessionUser();
      const token = a.tab.accessToken();
      hub.messages.length = 0;

      await expect(a.tab.signOut()).resolves.toBe(false);

      expect(a.signOutCall).toHaveBeenCalledTimes(1);
      expect(a.tab.getSessionUser()).toBe(user);
      expect(a.tab.accessToken()).toBe(token);
      expect(hub.messages).toEqual([]);
      expect(a.tab.takeSignInNotice()).toBeNull();
      expect(a.navigate).not.toHaveBeenCalled();
    },
  );

  it('retries a 409 sign-out once and resolves true when the retry works', async () => {
    const hub = createHub();
    const a = newTab(hub, createLocks());
    a.signOutCall.mockRejectedValueOnce(new HttpError({ kind: 'http', status: 409 }));
    a.tab.acceptSession(sessionResponse());

    await expect(a.tab.signOut()).resolves.toBe(true);

    expect(a.signOutCall).toHaveBeenCalledTimes(2);
    expect(a.tab.getSessionUser()).toBeNull();
  });

  it('a 409 twice resolves false and keeps the session, with no message and no notice', async () => {
    const hub = createHub();
    const a = newTab(hub, createLocks());
    a.signOutCall.mockRejectedValue(new HttpError({ kind: 'http', status: 409 }));
    a.tab.acceptSession(sessionResponse());
    hub.messages.length = 0;

    await expect(a.tab.signOut()).resolves.toBe(false);

    expect(a.signOutCall).toHaveBeenCalledTimes(2);
    expect(a.tab.getSessionUser()).not.toBeNull();
    expect(hub.messages).toEqual([]);
    expect(a.tab.takeSignInNotice()).toBeNull();
  });

  it('after a failed sign-out the session check keeps the user without a refresh, and a second sign-out can succeed', async () => {
    const hub = createHub();
    const a = newTab(hub, createLocks());
    a.signOutCall.mockRejectedValueOnce(new HttpError({ kind: 'network' }));
    a.tab.acceptSession(sessionResponse());

    await expect(a.tab.signOut()).resolves.toBe(false);
    await expect(a.tab.ensureSession()).resolves.toMatchObject({ name: 'Carmen Reyes' });
    expect(a.refresh).not.toHaveBeenCalled();

    await expect(a.tab.signOut()).resolves.toBe(true);
    expect(a.tab.getSessionUser()).toBeNull();
    expect(a.tab.takeSignInNotice()).toBe('signed-out');
  });

  it('after a confirmed sign-out the session check asks the server, gets 401 and keeps the signed-out notice', async () => {
    const hub = createHub();
    const a = newTab(hub, createLocks());
    a.refresh.mockRejectedValue(new HttpError({ kind: 'http', status: 401 }));
    a.tab.acceptSession(sessionResponse());

    await a.tab.signOut();

    await expect(a.tab.ensureSession()).resolves.toBeNull();
    expect(a.refresh).toHaveBeenCalledTimes(1);
    expect(a.tab.takeSignInNotice()).toBe('signed-out');
  });

  it('a sign-out in another tab clears this tab, sets session-ended and goes to the sign-in page', async () => {
    const hub = createHub();
    const a = newTab(hub, createLocks());
    const b = newTab(hub, createLocks());
    a.tab.acceptSession(sessionResponse());
    b.tab.acceptSession(sessionResponse());

    await a.tab.signOut();
    await Promise.resolve();

    expect(b.tab.getSessionUser()).toBeNull();
    expect(b.tab.takeSignInNotice()).toBe('session-ended');
    expect(b.navigate).toHaveBeenCalledWith('/admin/login');
  });

  it('a tab with no session ignores a sign-out from another tab', async () => {
    const hub = createHub();
    const a = newTab(hub, createLocks());
    const b = newTab(hub, createLocks());
    a.tab.acceptSession(sessionResponse());

    await a.tab.signOut();
    await Promise.resolve();

    expect(b.tab.takeSignInNotice()).toBeNull();
    expect(b.navigate).not.toHaveBeenCalled();
  });

  it('ignores a channel message it does not know', async () => {
    const hub = createHub();
    const a = newTab(hub, createLocks());
    a.tab.acceptSession(sessionResponse());
    const stranger = hub.create();

    stranger.postMessage({ type: 'something-else' });
    stranger.postMessage('text');
    stranger.postMessage(null);
    await Promise.resolve();

    expect(a.tab.getSessionUser()).not.toBeNull();
  });

  it('an unauthorized hook call clears the session, sets session-ended and goes to the sign-in page', () => {
    const hub = createHub();
    const a = newTab(hub, createLocks());
    a.tab.acceptSession(sessionResponse());

    a.tab.handleUnauthorized();

    expect(a.tab.getSessionUser()).toBeNull();
    expect(a.tab.takeSignInNotice()).toBe('session-ended');
    expect(a.navigate).toHaveBeenCalledWith('/admin/login');
  });

  it('works without a registered navigator and without a channel', async () => {
    const tab = createSession({
      auth: { refresh: vi.fn(), signOut: vi.fn(() => Promise.resolve()) },
      locks: null,
      createChannel: () => undefined,
    });
    tab.acceptSession(sessionResponse());

    tab.handleUnauthorized();
    await tab.signOut();

    expect(tab.getSessionUser()).toBeNull();
  });
});

describe('failures', () => {
  it('a 401 from the boot refresh means no session and sets no notice', async () => {
    const hub = createHub();
    const a = newTab(hub, createLocks());
    a.refresh.mockRejectedValue(new HttpError({ kind: 'http', status: 401 }));

    await expect(a.tab.ensureSession()).resolves.toBeNull();

    expect(a.tab.takeSignInNotice()).toBeNull();
  });

  it.each([
    ['a network failure', new HttpError({ kind: 'network' })],
    ['a timeout', new HttpError({ kind: 'timeout' })],
    ['a 429', new HttpError({ kind: 'http', status: 429 })],
    ['a 503', new HttpError({ kind: 'http', status: 503 })],
  ])(
    '%s in the boot refresh is not "no session": it surfaces so the person is not sent to sign in',
    async (_name, failure) => {
      const hub = createHub();
      const a = newTab(hub, createLocks());
      a.refresh.mockRejectedValue(failure);

      await expect(a.tab.ensureSession()).rejects.toBe(failure);
    },
  );

  it('a later boot after a transient failure tries the refresh again', async () => {
    const hub = createHub();
    const a = newTab(hub, createLocks());
    a.refresh.mockRejectedValueOnce(new HttpError({ kind: 'network' })).mockResolvedValueOnce(sessionResponse());

    await expect(a.tab.ensureSession()).rejects.toMatchObject({ kind: 'network' });
    await expect(a.tab.ensureSession()).resolves.toMatchObject({ name: 'Carmen Reyes' });
  });

  it('a programming error in the boot refresh is not swallowed', async () => {
    const hub = createHub();
    const a = newTab(hub, createLocks());
    a.refresh.mockRejectedValue(new TypeError('bug'));

    await expect(a.tab.ensureSession()).rejects.toThrow('bug');
  });

  it('retries a 409 auth.session-busy refresh once', async () => {
    const hub = createHub();
    const a = newTab(hub, createLocks());
    a.refresh
      .mockRejectedValueOnce(new HttpError({ kind: 'http', status: 409 }))
      .mockResolvedValueOnce(sessionResponse());

    await a.tab.refreshSession();

    expect(a.refresh).toHaveBeenCalledTimes(2);
    expect(a.tab.getSessionUser()?.name).toBe('Carmen Reyes');
  });

  it('gives up after a second 409 and keeps the session', async () => {
    const hub = createHub();
    const a = newTab(hub, createLocks());
    a.tab.acceptSession(sessionResponse());
    a.refresh.mockRejectedValue(new HttpError({ kind: 'http', status: 409 }));

    await expect(a.tab.refreshSession()).rejects.toMatchObject({ status: 409 });
    a.tab.handleUnauthorized();

    expect(a.refresh).toHaveBeenCalledTimes(2);
    expect(a.tab.getSessionUser()).not.toBeNull();
    expect(a.navigate).not.toHaveBeenCalled();
  });

  it('keeps the session when the refresh failed for a reason other than 401', async () => {
    const hub = createHub();
    const a = newTab(hub, createLocks());
    a.tab.acceptSession(sessionResponse());
    a.refresh.mockRejectedValue(new HttpError({ kind: 'network' }));

    await expect(a.tab.refreshSession()).rejects.toMatchObject({ kind: 'network' });
    a.tab.handleUnauthorized();

    expect(a.tab.getSessionUser()).not.toBeNull();
  });

  it('ends the session when the refresh itself answered 401', async () => {
    const hub = createHub();
    const a = newTab(hub, createLocks());
    a.tab.acceptSession(sessionResponse());
    a.refresh.mockRejectedValue(new HttpError({ kind: 'http', status: 401 }));

    await expect(a.tab.refreshSession()).rejects.toMatchObject({ status: 401 });
    a.tab.handleUnauthorized();

    expect(a.tab.getSessionUser()).toBeNull();
    expect(a.tab.takeSignInNotice()).toBe('session-ended');
  });
});

function answerSignOut(): void {
  server.use(http.post('*/api/v1/auth/sign-out', () => new HttpResponse(null, { status: 204 })));
}

describe('notices and the pending email', () => {
  beforeEach(() => {
    answerSignOut();
    clearSession();
    takeSignInNotice();
  });

  it('takeSignInNotice returns the key once, then null', () => {
    setSignInNotice('password-changed');

    expect(takeSignInNotice()).toBe('password-changed');
    expect(takeSignInNotice()).toBeNull();
  });

  it('takeSignedInToast returns the toast once, then null', () => {
    setSignedInToast('password-saved');

    expect(takeSignedInToast()).toBe('password-saved');
    expect(takeSignedInToast()).toBeNull();
  });

  it('keeps the pending email in memory only, and drops it on sign-in completion and on sign-out', async () => {
    setPendingEmail('lito@example.ph');
    expect(getPendingEmail()).toBe('lito@example.ph');

    acceptSession(sessionResponse());
    expect(getPendingEmail()).toBeNull();

    setPendingEmail('lito@example.ph');
    await signOut();
    expect(getPendingEmail()).toBeNull();
  });
});

describe('sign-in completion and the code step state (AUTH-02, D-01)', () => {
  beforeEach(() => {
    clearSession();
    takeSignInNotice();
  });

  it('completeSignIn stores the session, drops the pending email and the code step state, and shows the user', () => {
    setPendingEmail('lito@example.ph');
    setResendAvailableAt(Date.now() + 60_000);

    completeSignIn(sessionResponse());

    expect(getSessionUser()?.name).toBe('Carmen Reyes');
    expect(getPendingEmail()).toBeNull();
    expect(getResendAvailableAt()).toBeNull();
  });

  it('completeSignIn with an unknown role keeps no session and tells no other tab (IN-17)', () => {
    const hub = createHub();
    const tab = createSession({
      auth: { refresh: vi.fn(), signOut: vi.fn() },
      locks: null,
      createChannel: () => hub.create(),
    });

    tab.completeSignIn(responseWithRole('Owner'));

    expect(tab.getSessionUser()).toBeNull();
    expect(tab.accessToken()).toBeNull();
    expect(hub.messages).toEqual([]);
  });

  it('completeSignIn tells other tabs a session exists, with the expiry only', () => {
    const hub = createHub();
    const tab = createSession({
      auth: { refresh: vi.fn(), signOut: vi.fn() },
      locks: null,
      createChannel: () => hub.create(),
    });
    const response = sessionResponse();

    tab.completeSignIn(response);

    expect(hub.messages).toEqual([{ type: 'refreshed', expiresAt: Date.parse(response.accessTokenExpiresAt) }]);
    expect(JSON.stringify(hub.messages)).not.toContain(response.accessToken);
  });

  it('keeps the resend time in memory and clears it with the session', () => {
    expect(getResendAvailableAt()).toBeNull();

    setResendAvailableAt(1_700_000_000_000);
    expect(getResendAvailableAt()).toBe(1_700_000_000_000);

    clearSession();
    expect(getResendAvailableAt()).toBeNull();
  });

  it('writes none of it to a browser store', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    setResendAvailableAt(Date.now() + 60_000);
    completeSignIn(sessionResponse());

    expect(setItem).not.toHaveBeenCalled();
    expect(document.cookie).toBe('');
    setItem.mockRestore();
  });
});

describe('the shared session wired to the shared client', () => {
  const navigate = vi.fn();

  beforeEach(() => {
    answerSignOut();
    navigate.mockReset();
    setNavigator(navigate);
    clearSession();
    takeSignInNotice();
  });

  afterEach(() => {
    clearSession();
    takeSignInNotice();
  });

  function answerRefresh(...replies: (() => Response)[]): () => number {
    let calls = 0;
    server.use(
      http.post('*/api/v1/auth/refresh', () => {
        const reply = replies[Math.min(calls, replies.length - 1)] ?? (() => new HttpResponse(null, { status: 500 }));
        calls += 1;
        return reply();
      }),
    );
    return () => calls;
  }

  const unauthorized = () =>
    HttpResponse.json(
      { title: 'x', status: 401 },
      { status: 401, headers: { 'Content-Type': 'application/problem+json' } },
    );
  const busy = () =>
    HttpResponse.json(
      { title: 'x', status: 409, code: 'auth.session-busy' },
      { status: 409, headers: { 'Content-Type': 'application/problem+json' } },
    );

  it('sends the access token as a Bearer header and X-CSPS-CSRF', async () => {
    acceptSession(sessionResponse({ accessToken: 'live-token' }));
    let seen: { auth: string | null; csrf: string | null } | undefined;
    server.use(
      http.get('*/api/v1/ping', ({ request }) => {
        seen = { auth: request.headers.get('Authorization'), csrf: request.headers.get('X-CSPS-CSRF') };
        return HttpResponse.json({ ok: true });
      }),
    );

    await apiClient.get('/ping');

    expect(seen).toEqual({ auth: 'Bearer live-token', csrf: '1' });
  });

  it('a 401 followed by a failed refresh clears the session and goes to sign-in with session-ended', async () => {
    acceptSession(sessionResponse());
    server.use(http.get('*/api/v1/ping', () => unauthorized()));
    answerRefresh(unauthorized);

    await expect(apiClient.get('/ping')).rejects.toMatchObject({ status: 401 });

    expect(getSessionUser()).toBeNull();
    expect(takeSignInNotice()).toBe('session-ended');
    expect(navigate).toHaveBeenCalledWith('/admin/login');
  });

  it('a 401 followed by a refresh with an unknown role signs the person out like a refused refresh', async () => {
    acceptSession(sessionResponse());
    server.use(http.get('*/api/v1/ping', () => unauthorized()));
    answerRefresh(() => HttpResponse.json(responseWithRole('Owner')));

    await expect(apiClient.get('/ping')).rejects.toMatchObject({ status: 401 });

    expect(getSessionUser()).toBeNull();
    expect(takeSignInNotice()).toBe('session-ended');
    expect(navigate).toHaveBeenCalledWith('/admin/login');
  });

  it('a 401 followed by a refresh that works replays the request with the new token', async () => {
    acceptSession(sessionResponse({ accessToken: 'old-token' }));
    const tokens: (string | null)[] = [];
    server.use(
      http.get('*/api/v1/ping', ({ request }) => {
        tokens.push(request.headers.get('Authorization'));
        return tokens.length === 1 ? unauthorized() : HttpResponse.json({ ok: true });
      }),
    );
    answerRefresh(() => HttpResponse.json(sessionResponse({ accessToken: 'new-token' })));

    await apiClient.get('/ping');

    expect(tokens).toEqual(['Bearer old-token', 'Bearer new-token']);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('a 409 session-busy refresh is retried once and the request then succeeds', async () => {
    acceptSession(sessionResponse({ accessToken: 'old-token' }));
    let pings = 0;
    server.use(
      http.get('*/api/v1/ping', () => {
        pings += 1;
        return pings === 1 ? unauthorized() : HttpResponse.json({ ok: true });
      }),
    );
    const refreshCalls = answerRefresh(busy, () => HttpResponse.json(sessionResponse({ accessToken: 'new-token' })));

    await apiClient.get('/ping');

    expect(refreshCalls()).toBe(2);
    expect(getSessionUser()).not.toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('two 409s do not sign the user out', async () => {
    acceptSession(sessionResponse());
    server.use(http.get('*/api/v1/ping', () => unauthorized()));
    answerRefresh(busy);

    await expect(apiClient.get('/ping')).rejects.toMatchObject({ status: 401 });

    expect(getSessionUser()).not.toBeNull();
    expect(takeSignInNotice()).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('ensureSession and refreshSession of the shared session use the refresh cookie route', async () => {
    const calls = answerRefresh(() => HttpResponse.json(sessionResponse()));

    await expect(ensureSession()).resolves.toMatchObject({ name: 'Carmen Reyes', role: 'manager' });
    await refreshSession();

    expect(calls()).toBe(2);
  });

  it('keeps the token, the code and the email out of every browser store', async () => {
    const stores = [vi.spyOn(Storage.prototype, 'setItem'), vi.spyOn(document, 'cookie', 'set')];
    answerRefresh(() => HttpResponse.json(sessionResponse({ accessToken: 'secret-access-token' })));

    await ensureSession();
    setPendingEmail('lito@example.ph');
    await signOut();

    for (const store of stores) {
      expect(store).not.toHaveBeenCalled();
    }
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(document.cookie).toBe('');
  });
});
