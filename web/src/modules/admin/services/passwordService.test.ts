// The password calls (AUTH-08, AUTH-09, D-16, D-17; plan 04-28), over MSW.
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { server } from '@/test/msw';
import { sessionResponse } from '@/test/sessionFixtures';
import { createPasswordService } from './passwordService';

const problem = { title: 'Sign in again', status: 401 };

interface Seen {
  method: string;
  path: string;
  search: string;
  idempotencyKey: string | null;
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
        idempotencyKey: request.headers.get('Idempotency-Key'),
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
  const service = createPasswordService(createHttpClient({ baseURL: '/api/v1', refresh, onUnauthorized }));
  return { service, refresh, onUnauthorized };
}

const TOKEN = 'T'.repeat(43);

describe('passwordService routes', () => {
  it('forgot posts the email to /auth/password/forgot with the Idempotency-Key it was given', async () => {
    const seen = answer('/api/v1/auth/password/forgot', () => new HttpResponse(null, { status: 202 }));

    await expect(
      build().service.forgot({ email: 'paolo.garcia@gmail.com' }, { idempotencyKey: 'key-forgot-1' }),
    ).resolves.toBeUndefined();

    expect(seen).toEqual([
      {
        method: 'POST',
        path: '/api/v1/auth/password/forgot',
        search: '',
        idempotencyKey: 'key-forgot-1',
        body: { email: 'paolo.garcia@gmail.com' },
      },
    ]);
  });

  it('checkResetLink posts the token in the body and never in the address', async () => {
    const reply = { email: 'paolo@gmail.com', firstName: 'Paolo', lastName: 'Garcia' };
    const seen = answer('/api/v1/auth/password/reset/check', () => HttpResponse.json(reply));

    await expect(build().service.checkResetLink({ token: TOKEN })).resolves.toEqual(reply);

    expect(seen[0]).toMatchObject({ method: 'POST', search: '', body: { token: TOKEN } });
    expect(seen[0]?.path).not.toContain(TOKEN);
  });

  it('resetPassword posts the token and password in the body with the given Idempotency-Key', async () => {
    const seen = answer('/api/v1/auth/password/reset', () => new HttpResponse(null, { status: 204 }));

    await expect(
      build().service.resetPassword(
        { token: TOKEN, newPassword: 'Mabuhay#Tahi2026' },
        { idempotencyKey: 'key-reset-1' },
      ),
    ).resolves.toBeUndefined();

    expect(seen[0]).toMatchObject({
      method: 'POST',
      path: '/api/v1/auth/password/reset',
      search: '',
      idempotencyKey: 'key-reset-1',
      body: { token: TOKEN, newPassword: 'Mabuhay#Tahi2026' },
    });
  });

  it('setNewPassword posts the password to /auth/password/set-new and resolves the session', async () => {
    const session = sessionResponse();
    const seen = answer('/api/v1/auth/password/set-new', () => HttpResponse.json(session));

    await expect(build().service.setNewPassword({ newPassword: 'Mabuhay#Tahi2026' })).resolves.toEqual(session);

    expect(seen[0]).toMatchObject({ method: 'POST', search: '', body: { newPassword: 'Mabuhay#Tahi2026' } });
    expect(seen[0]?.idempotencyKey).toBeNull();
  });
});

describe('passwordService must-change context', () => {
  it('checkSetNewPassword posts to /auth/password/set-new/check with no body, the CSRF header and no auth refresh', async () => {
    const context = { email: 'lito@gmail.com', firstName: 'Lito', lastName: 'Ramos', reason: 'breach' };
    const arrived: { method: string; search: string; csrf: string | null; body: string }[] = [];
    server.use(
      http.post('*/api/v1/auth/password/set-new/check', async ({ request }) => {
        arrived.push({
          method: request.method,
          search: new URL(request.url).search,
          csrf: request.headers.get('X-CSPS-CSRF'),
          body: await request.text(),
        });
        return HttpResponse.json(context);
      }),
    );
    const { service, refresh } = build();

    await expect(service.checkSetNewPassword()).resolves.toEqual(context);

    expect(arrived).toEqual([{ method: 'POST', search: '', csrf: '1', body: '' }]);
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('passwordService 401 handling (skipAuthRefresh)', () => {
  it.each([
    [
      'checkResetLink',
      '/api/v1/auth/password/reset/check',
      (s: ReturnType<typeof build>['service']) => s.checkResetLink({ token: TOKEN }),
    ],
    [
      'checkSetNewPassword',
      '/api/v1/auth/password/set-new/check',
      (s: ReturnType<typeof build>['service']) => s.checkSetNewPassword(),
    ],
    [
      'setNewPassword',
      '/api/v1/auth/password/set-new',
      (s: ReturnType<typeof build>['service']) => s.setNewPassword({ newPassword: 'Mabuhay#Tahi2026' }),
    ],
  ])('%s: a 401 rejects as the answer, with no refresh and no sign-out', async (_name, path, call) => {
    answer(path, unauthorized);
    const { service, refresh, onUnauthorized } = build();

    await expect(call(service)).rejects.toMatchObject({ status: 401 });

    expect(refresh).not.toHaveBeenCalled();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
