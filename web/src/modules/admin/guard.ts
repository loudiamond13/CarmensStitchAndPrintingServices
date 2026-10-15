// The admin route guard and the return-path check (D-07, CWE-601; plan 04-25). Redirects come from route loaders, never
// from a <Navigate> element (nuqs #1245).
import { redirect, type LoaderFunctionArgs } from 'react-router';
import { ensureSession, type SessionUser } from './services/session';

const ADMIN_HOME = '/admin';
const LOGIN_PATH = '/admin/login';

/** True for a control character or a backslash, which browsers read as a slash. */
function hasUnsafeCharacter(text: string): boolean {
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code < 0x20 || code === 0x7f || code === 0x5c) {
      return true;
    }
  }
  return false;
}

/**
 * The path to return to after sign-in. Only a same-origin path under /admin that is not the sign-in area is accepted
 * (checked once decoded, so encoded tricks fail too); anything else gives /admin. The path never carries a token or code.
 */
export function safeReturnUrl(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return ADMIN_HOME;
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return ADMIN_HOME;
  }
  // A second layer of encoding would decode to a different path later, so it is refused.
  if (decoded.includes('%') || hasUnsafeCharacter(decoded) || hasUnsafeCharacter(value)) {
    return ADMIN_HOME;
  }
  if (decoded !== ADMIN_HOME && !/^\/admin[/?#]/.test(decoded)) {
    return ADMIN_HOME;
  }
  if (decoded.toLowerCase().startsWith(LOGIN_PATH)) {
    return ADMIN_HOME;
  }
  const segments = (decoded.split(/[?#]/)[0] ?? '').split('/');
  if (segments.includes('..') || segments.includes('.')) {
    return ADMIN_HOME;
  }
  return value;
}

/** The loader of the admin layout: boots the session, or sends the visitor to sign in and back. */
export async function requireSessionLoader({ request }: Pick<LoaderFunctionArgs, 'request'>): Promise<SessionUser> {
  const user = await ensureSession();
  if (user === null) {
    const { pathname, search } = new URL(request.url);
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router's redirect() is thrown by design.
    throw redirect(`${LOGIN_PATH}?returnUrl=${encodeURIComponent(safeReturnUrl(`${pathname}${search}`))}`);
  }
  return user;
}

/**
 * The loader of the sign-in routes: a live session goes to the safe return path (/admin without one), so a deep link
 * survives a reload; a failed session check never throws.
 */
export async function redirectIfSignedInLoader({ request }: Pick<LoaderFunctionArgs, 'request'>): Promise<null> {
  let signedIn = false;
  try {
    signedIn = (await ensureSession()) !== null;
  } catch {
    // A failed check counts as no session: the sign-in page must still open.
  }
  if (signedIn) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router's redirect() is thrown by design.
    throw redirect(safeReturnUrl(new URL(request.url).searchParams.get('returnUrl')));
  }
  return null;
}
