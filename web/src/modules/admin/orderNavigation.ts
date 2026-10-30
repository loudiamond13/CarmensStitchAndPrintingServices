// Where the order screens send a person back to (D-51). The list sends its own address in the navigation state; only a literal
// Orders path is followed, so a crafted state cannot make the app redirect elsewhere (CWE-601, T-08-18).
import { safeReturnUrl } from '@/modules/admin/guard';

export const ORDERS_PATH = '/admin/orders';

/**
 * Where Back goes: the list address in the navigation state, when it is a literal Orders path. Anything else, a foreign host, a
 * protocol-relative address, another admin page or a value that is not text, goes to the Orders list. `safeReturnUrl` keeps only
 * admin paths; the prefix check then keeps only Orders ones.
 */
export function backTarget(state: unknown): string {
  if (typeof state !== 'object' || state === null || !('from' in state) || typeof state.from !== 'string') {
    return ORDERS_PATH;
  }
  const from = safeReturnUrl(state.from);
  const path = from.split(/[?#]/)[0] ?? '';
  return path === ORDERS_PATH || path.startsWith(`${ORDERS_PATH}/`) ? from : ORDERS_PATH;
}
