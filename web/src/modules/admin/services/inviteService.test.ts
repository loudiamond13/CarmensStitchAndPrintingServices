// The invite calls (AUTH-12, D-29; plan 04-31), over MSW.
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { server } from '@/test/msw';
import { createInviteService } from './inviteService';

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

function notFound(): Response {
  return HttpResponse.json(
    { title: 'This invite has expired', status: 404, code: 'auth.invite-invalid' },
    { status: 404, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

function build() {
  const refresh = vi.fn(() => Promise.resolve());
  const onUnauthorized = vi.fn();
  const service = createInviteService(createHttpClient({ baseURL: '/api/v1', refresh, onUnauthorized }));
  return { service, refresh, onUnauthorized };
}

const TOKEN = 'T'.repeat(43);

describe('inviteService', () => {
  it('check posts the token in the body, never in the address, and resolves the email and first name', async () => {
    const seen = answer('/api/v1/auth/invite/check', () => HttpResponse.json({ email: 'a@b.com', firstName: 'Ana' }));

    await expect(build().service.check({ token: TOKEN })).resolves.toEqual({ email: 'a@b.com', firstName: 'Ana' });

    expect(seen[0]).toMatchObject({ method: 'POST', search: '', body: { token: TOKEN } });
    expect(seen[0]?.path).not.toContain(TOKEN);
  });

  it('accept posts the token and password with the Idempotency-Key it was given', async () => {
    const seen = answer('/api/v1/auth/invite/accept', () => new HttpResponse(null, { status: 204 }));

    await expect(
      build().service.accept({ token: TOKEN, newPassword: 'Mabuhay#Tahi2026' }, { idempotencyKey: 'key-accept-1' }),
    ).resolves.toBeUndefined();

    expect(seen[0]).toMatchObject({
      method: 'POST',
      path: '/api/v1/auth/invite/accept',
      search: '',
      idempotencyKey: 'key-accept-1',
      body: { token: TOKEN, newPassword: 'Mabuhay#Tahi2026' },
    });
  });

  it.each([
    ['check', '/api/v1/auth/invite/check', (s: ReturnType<typeof build>['service']) => s.check({ token: TOKEN })],
    [
      'accept',
      '/api/v1/auth/invite/accept',
      (s: ReturnType<typeof build>['service']) =>
        s.accept({ token: TOKEN, newPassword: 'Mabuhay#Tahi2026' }, { idempotencyKey: 'k' }),
    ],
  ])(
    '%s: a 404 rejects as the answer, with no refresh and no sign-out (skipAuthRefresh)',
    async (_name, path, call) => {
      answer(path, notFound);
      const { service, refresh, onUnauthorized } = build();

      await expect(call(service)).rejects.toMatchObject({ status: 404, code: 'auth.invite-invalid' });

      expect(refresh).not.toHaveBeenCalled();
      expect(onUnauthorized).not.toHaveBeenCalled();
    },
  );

  it('a 401 is the answer too: no refresh and no sign-out', async () => {
    answer('/api/v1/auth/invite/check', () =>
      HttpResponse.json(
        { title: 'No', status: 401 },
        { status: 401, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    );
    const { service, refresh, onUnauthorized } = build();

    await expect(service.check({ token: TOKEN })).rejects.toMatchObject({ status: 401 });

    expect(refresh).not.toHaveBeenCalled();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
