// The secure refresh cookie in three engines (AUTH-05, research Pitfall 2, assumption A8; plan 04-27). After a real
// sign-in on the HTTPS E2E host, the browser must hold __Secure-csps_rt with HttpOnly, Secure, SameSite Strict and
// Path /api/v1/auth. With "Keep me signed in" it lasts about 90 days; without it, it is a session cookie. Page scripts
// cannot read it. The phone projects reuse the same engines, so this runs in chromium, firefox and webkit only.
//
// Two views of the same cookie are checked:
//   - the Set-Cookie header the browser received on the verify answer (what the server sent), in all three engines;
//   - the browser's cookie jar after sign-in (what the engine stored), in all three engines for HttpOnly, Secure, Path and
//     the lifetime. Playwright's WebKit on Windows reports `sameSite: "None"` for every cookie it holds, whatever was set
//     (even one added with `sameSite: "Strict"`), so the jar's SameSite is asserted in chromium and firefox only and
//     WebKit's SameSite rests on the header (a gap recorded for Phase 3 to confirm on real Safari over HTTPS).
import { signInAs } from './auth.ts';
import { expect, test } from './fixtures.ts';
import { createStaff } from './testing-api.ts';

const REFRESH_COOKIE = '__Secure-csps_rt';
const TICKET_COOKIE = '__Secure-csps_2fa';
const AUTH_URL = 'https://localhost:5199/api/v1/auth/refresh';
const DAY_SECONDS = 24 * 60 * 60;

/** The attribute names of one Set-Cookie header value, lower-cased ("httponly", "samesite=strict", "path=/api/v1/auth"). */
function attributes(setCookie: string): string[] {
  return setCookie
    .split(';')
    .slice(1)
    .map((part) => part.trim().toLowerCase());
}

for (const keepSignedIn of [true, false]) {
  const choice = keepSignedIn ? 'with "Keep me signed in"' : 'without "Keep me signed in"';

  test(`@auth-cookies the refresh cookie ${choice} is HttpOnly, Secure, SameSite Strict and scoped to the auth API`, async ({
    page,
    request,
    guard,
    browserName,
  }) => {
    // The sign-in pages ask the refresh cookie for a session first; with none, that answer is a 401.
    guard.expectStatus('/api/v1/auth/refresh', 401);
    const staff = await createStaff(request, 'Manager');
    const verified = page.waitForResponse((response) => response.url().endsWith('/api/v1/auth/two-factor/verify'));

    await signInAs(page, request, staff, { keepSignedIn });

    // What the server sent on the verify answer.
    const header = (await (await verified).headerValues('set-cookie')).find((value) =>
      value.startsWith(`${REFRESH_COOKIE}=`),
    );
    expect(header, `the verify answer sets ${REFRESH_COOKIE}`).toBeDefined();
    const sent = attributes(header ?? '');
    expect(sent).toEqual(expect.arrayContaining(['httponly', 'secure', 'samesite=strict', 'path=/api/v1/auth']));
    expect(sent.some((attribute) => attribute.startsWith('expires='))).toBe(keepSignedIn);

    // What the browser stored.
    const cookies = await page.context().cookies(AUTH_URL);
    const refresh = cookies.find((cookie) => cookie.name === REFRESH_COOKIE);
    expect(refresh, `${REFRESH_COOKIE} is in the browser after sign-in`).toBeDefined();
    expect(refresh).toMatchObject({ httpOnly: true, secure: true, path: '/api/v1/auth' });
    if (browserName !== 'webkit') {
      expect(refresh?.sameSite).toBe('Strict');
    }
    if (keepSignedIn) {
      const ninetyDaysAhead = Date.now() / 1000 + 90 * DAY_SECONDS;
      expect(refresh?.expires ?? 0).toBeGreaterThan(ninetyDaysAhead - DAY_SECONDS);
      expect(refresh?.expires ?? 0).toBeLessThan(ninetyDaysAhead + DAY_SECONDS);
    } else {
      expect(refresh?.expires).toBe(-1);
    }

    // The pending-sign-in ticket is gone once the session exists.
    expect(cookies.find((cookie) => cookie.name === TICKET_COOKIE)).toBeUndefined();

    // Page scripts cannot read it, whatever the path.
    expect(await page.evaluate('document.cookie')).not.toContain('csps_rt');

    // The session survives a reload through the cookie alone: the sign-in page sends the visitor on to /admin.
    await page.goto('/admin/login');
    await expect(page).toHaveURL(/\/admin$/);
    const after = (await page.context().cookies(AUTH_URL)).find((cookie) => cookie.name === REFRESH_COOKIE);
    expect(after).toMatchObject({ httpOnly: true, secure: true, path: '/api/v1/auth' });
    expect(after?.expires === -1).toBe(!keepSignedIn);
  });
}
