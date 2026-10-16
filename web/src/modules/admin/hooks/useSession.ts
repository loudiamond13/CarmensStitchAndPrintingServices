// The current session for components: re-renders when it changes (sign-in, refresh of the user, sign-out).
import { useSyncExternalStore } from 'react';
import { getSessionSnapshot, subscribeSession, type SessionSnapshot } from '@/modules/admin/services/session';

export function useSession(): SessionSnapshot {
  return useSyncExternalStore(subscribeSession, getSessionSnapshot);
}
