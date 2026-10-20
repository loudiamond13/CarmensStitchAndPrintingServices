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
 * The path to return to after sign-in, returned exactly as validated. Only a literal path that starts with a single
 * "/" under /admin (and not the sign-in area) is accepted: the path part is checked once decoded, the query and hash are
 * kept as given, so a literal "%25" survives. An encoded start, "//host" and backslash forms give /admin (CWE-601).
 */
export function safeReturnUrl(value: string | null | undefined): string {
  if (value === null || value === undefined || !value.startsWith('/') || value.startsWith('//')) {
    return ADMIN_HOME;
  }
  if (hasUnsafeCharacter(value)) {
    return ADMIN_HOME;
  }
  const path = value.split(/[?#]/)[0] ?? '';
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return ADMIN_HOME;
  }
  // A second layer of encoding would decode to a different path later, so it is refused.
  if (decoded.includes('%') || hasUnsafeCharacter(decoded)) {
    return ADMIN_HOME;
  }
  if (decoded !== ADMIN_HOME && !decoded.startsWith(`${ADMIN_HOME}/`)) {
    return ADMIN_HOME;
  }
  if (decoded.toLowerCase().startsWith(LOGIN_PATH)) {
    return ADMIN_HOME;
  }
  const segments = decoded.split('/');
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
 * The loader of the Manager-only routes (Users, Audit Log): the session check first, so a visitor without a session goes
 * to sign-in with the return path, then only the manager role passes. An Admin goes to /admin (USER-08).
 */
export async function requireManagerLoader(args: Pick<LoaderFunctionArgs, 'request'>): Promise<SessionUser> {
  const user = await requireSessionLoader(args);
  if (user.role !== 'manager') {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router's redirect() is thrown by design.
    throw redirect(ADMIN_HOME);
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
