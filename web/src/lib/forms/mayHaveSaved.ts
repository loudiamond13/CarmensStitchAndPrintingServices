import { isHttpError } from '@/core/api/errors';

/**
 * True when a failed save may still have been recorded by the server: no answer (network, timeout, cancelled), an unreadable 2xx,
 * a 5xx or a 408. The money, the dashboard and the record on screen are then read again, so a second save is made with the fresh
 * figures in view. A final 4xx is a refusal that saved nothing.
 */
export function mayHaveSaved(error: unknown): boolean {
  if (!isHttpError(error) || error.kind !== 'http') {
    return true;
  }
  return error.status >= 500 || error.status === 408;
}
