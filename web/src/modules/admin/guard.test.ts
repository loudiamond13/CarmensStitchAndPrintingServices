// The admin route guard and the return-path check (D-07, CWE-601, plan 04-25).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { redirectIfSignedInLoader, requireSessionLoader, safeReturnUrl } from './guard';

const ensureSession = vi.fn();
vi.mock('./services/session', () => ({ ensureSession: (): unknown => ensureSession() }));

const user = { id: 'u1', email: 'carmen@example.ph', name: 'Carmen Reyes', role: 'manager' } as const;

function args(url: string) {
  return { request: new Request(`http://localhost${url}`), params: {}, context: undefined } as never;
}

async function thrown(run: () => unknown): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  return undefined;
}

beforeEach(() => {
  ensureSession.mockReset();
});

describe('safeReturnUrl (D-07)', () => {
  it.each(['/admin', '/admin/orders', '/admin/orders?page=2', '/admin/sessions'])('keeps %s', (value) => {
    expect(safeReturnUrl(value)).toBe(value);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty', ''],
    ['the login page', '/admin/login'],
    ['a login sub page', '/admin/login/verify'],
    ['an absolute URL', 'https://evil.example/admin'],
    ['a protocol-relative URL', '//evil.example'],
    ['a backslash host', '/\\evil.example'],
    ['an encoded double slash', '/%2F%2Fevil.example'],
    ['an encoded dot-dot segment', '/admin/%2e%2e/x'],
    ['a dot-dot segment', '/admin/../x'],
    ['a javascript URL', 'javascript:alert(1)'],
    ['a control character', '/admin\u0000x'],
    ['an encoded control character', '/admin/%00x'],
    ['an encoded backslash', '/admin%5Cx'],
    ['a path outside /admin', '/public'],
    ['a relative path', 'admin/orders'],
    ['the prefix without a segment boundary', '/administrator'],
    ['a malformed percent escape', '/admin/%E0%A4%A'],
    ['a double-encoded login', '/admin/%256Cogin'],
  ])('falls back to /admin for %s', (_name, value) => {
    expect(safeReturnUrl(value)).toBe('/admin');
  });
});

describe('requireSessionLoader', () => {
  it('returns the session user when there is a session', async () => {
    ensureSession.mockResolvedValue(user);

    await expect(requireSessionLoader(args('/admin/orders'))).resolves.toBe(user);
  });

  it('redirects to the sign-in page with the encoded return path when there is no session', async () => {
    ensureSession.mockResolvedValue(null);

    const response = await thrown(() => requireSessionLoader(args('/admin/orders?page=2')));

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(302);
    expect((response as Response).headers.get('Location')).toBe('/admin/login?returnUrl=%2Fadmin%2Forders%3Fpage%3D2');
  });

  it('lets a failed session check reach the error screen instead of sending a signed-in person to sign in', async () => {
    ensureSession.mockRejectedValue(new Error('server is down'));

    await expect(requireSessionLoader(args('/admin/orders'))).rejects.toThrow('server is down');
  });
});

describe('redirectIfSignedInLoader', () => {
  it('redirects a live session to /admin', async () => {
    ensureSession.mockResolvedValue(user);

    const response = await thrown(() => redirectIfSignedInLoader(args('/admin/login')));

    expect((response as Response).headers.get('Location')).toBe('/admin');
  });

  it('redirects a live session to the safe return path, so a deep link survives a reload', async () => {
    ensureSession.mockResolvedValue(user);

    const response = await thrown(() =>
      redirectIfSignedInLoader(args('/admin/login?returnUrl=%2Fadmin%2Forders%2F123%3Ftab%3Dpayments')),
    );

    expect((response as Response).headers.get('Location')).toBe('/admin/orders/123?tab=payments');
  });

  it.each(['https://evil.example/admin', '//evil.example', '/public', '/admin/login'])(
    'ignores the unsafe return path %s',
    async (returnUrl) => {
      ensureSession.mockResolvedValue(user);

      const response = await thrown(() =>
        redirectIfSignedInLoader(args(`/admin/login?returnUrl=${encodeURIComponent(returnUrl)}`)),
      );

      expect((response as Response).headers.get('Location')).toBe('/admin');
    },
  );

  it('lets an anonymous visitor through', async () => {
    ensureSession.mockResolvedValue(null);

    await expect(redirectIfSignedInLoader(args('/admin/login'))).resolves.toBeNull();
  });

  it('never throws when the session check fails', async () => {
    ensureSession.mockRejectedValue(new Error('network'));

    await expect(redirectIfSignedInLoader(args('/admin/login'))).resolves.toBeNull();
  });
});
