// The authentication calls (AUTH-01 to AUTH-06; plan 04-25), over MSW.
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { server } from '@/test/msw';
import { sessionResponse } from '@/test/sessionFixtures';
import { createAuthService, type ResendWaitResponse } from './authService';

const problem = { title: 'Sign in again', status: 401 };

interface Seen {
  method: string;
  path: string;
  search: string;
  body: unknown;
}

/** Answers `path` with `reply` and records what arrived. */
function answer(path: string, reply: () => Response): Seen[] {
  const seen: Seen[] = [];
  server.use(
    http.post(`*${path}`, async ({ request }) => {
      const url = new URL(request.url);
      const text = await request.text();
      seen.push({
        method: request.method,
        path: url.pathname,
        search: url.search,
        body: text === '' ? undefined : (JSON.parse(text) as unknown),
      });
      return reply();
    }),
  );
  return seen;
}

function unauthorized(): Response {
  return HttpResponse.json(problem, { status: 401, headers: { 'Content-Type': 'application/problem+json' } });
}

function build() {
  const refresh = vi.fn(() => Promise.resolve());
  const onUnauthorized = vi.fn();
  const service = createAuthService(createHttpClient({ baseURL: '/api/v1', refresh, onUnauthorized }));
  return { service, refresh, onUnauthorized };
}

describe('authService routes', () => {
  it('signIn posts the form to /auth/sign-in', async () => {
    const seen = answer('/api/v1/auth/sign-in', () => HttpResponse.json({ resendAfterSeconds: 60 }));

    const result: ResendWaitResponse = await build().service.signIn({
      email: 'a@b.ph',
      password: 'pw',
      keepSignedIn: true,
    });

    expect(result).toEqual({ resendAfterSeconds: 60 });
    expect(seen).toEqual([
      {
        method: 'POST',
        path: '/api/v1/auth/sign-in',
        search: '',
        body: { email: 'a@b.ph', password: 'pw', keepSignedIn: true },
      },
    ]);
  });

  it('verifyCode posts the code in the body to /auth/two-factor/verify', async () => {
    const seen = answer('/api/v1/auth/two-factor/verify', () =>
      HttpResponse.json({ next: 'signed-in', reason: null, session: sessionResponse() }),
    );

    const result = await build().service.verifyCode({ code: '123456' });

    expect(result.next).toBe('signed-in');
    expect(seen[0]).toMatchObject({ method: 'POST', search: '', body: { code: '123456' } });
  });

  it('resendCode posts to /auth/two-factor/resend', async () => {
    const seen = answer('/api/v1/auth/two-factor/resend', () => HttpResponse.json({ resendAfterSeconds: 30 }));

    const result: ResendWaitResponse = await build().service.resendCode();

    expect(result).toEqual({ resendAfterSeconds: 30 });
    expect(seen[0]).toMatchObject({ method: 'POST', search: '' });
  });

  it('refresh posts to /auth/refresh and resolves the session', async () => {
    const session = sessionResponse();
    const seen = answer('/api/v1/auth/refresh', () => HttpResponse.json(session));

    await expect(build().service.refresh()).resolves.toEqual(session);
    expect(seen[0]).toMatchObject({ method: 'POST', path: '/api/v1/auth/refresh', search: '' });
  });

  it('signOut posts to /auth/sign-out and resolves on 204', async () => {
    const seen = answer('/api/v1/auth/sign-out', () => new HttpResponse(null, { status: 204 }));

    await expect(build().service.signOut()).resolves.toBeUndefined();
    expect(seen[0]).toMatchObject({ method: 'POST', search: '' });
  });

  it('signOutOthers posts to /auth/sign-out-others and resolves on 204', async () => {
    const seen = answer('/api/v1/auth/sign-out-others', () => new HttpResponse(null, { status: 204 }));

    await expect(build().service.signOutOthers()).resolves.toBeUndefined();
    expect(seen[0]).toMatchObject({ method: 'POST', search: '' });
  });
});

describe('authService 401 handling (skipAuthRefresh)', () => {
  it.each([
    [
      'signIn',
      '/api/v1/auth/sign-in',
      (s: ReturnType<typeof build>['service']) => s.signIn({ email: 'a@b.ph', password: 'x', keepSignedIn: false }),
    ],
    [
      'verifyCode',
      '/api/v1/auth/two-factor/verify',
      (s: ReturnType<typeof build>['service']) => s.verifyCode({ code: '000000' }),
    ],
    ['resendCode', '/api/v1/auth/two-factor/resend', (s: ReturnType<typeof build>['service']) => s.resendCode()],
    ['refresh', '/api/v1/auth/refresh', (s: ReturnType<typeof build>['service']) => s.refresh()],
    ['signOut', '/api/v1/auth/sign-out', (s: ReturnType<typeof build>['service']) => s.signOut()],
  ])('%s: a 401 rejects as the answer, with no refresh and no sign-out', async (_name, path, call) => {
    answer(path, unauthorized);
    const { service, refresh, onUnauthorized } = build();

    await expect(call(service)).rejects.toMatchObject({ status: 401 });

    expect(refresh).not.toHaveBeenCalled();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('signOutOthers is a signed-in call: a 401 runs the session refresh', async () => {
    const seen: number[] = [];
    server.use(
      http.post('*/api/v1/auth/sign-out-others', () => {
        seen.push(seen.length);
        return seen.length === 1 ? unauthorized() : new HttpResponse(null, { status: 204 });
      }),
    );
    const { service, refresh } = build();

    await service.signOutOthers();

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(seen).toHaveLength(2);
  });
});
