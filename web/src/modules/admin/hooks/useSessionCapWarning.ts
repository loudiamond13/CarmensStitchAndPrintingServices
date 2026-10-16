// The OQ-4 warning (WCAG 2.2.1 Timing Adjustable): a browser session (sign-in without "Keep me signed in") ends at the
// 12-hour cap, so a persistent warning toast appears 5 minutes before it, with the time in business time. A kept-signed-in
// session lasts 90 days and never warns. One timer per cap; a refresh that brings the same cap changes nothing.
// SPEC-GAP: session-cap warning (OQ-4)
import { useEffect, useRef } from 'react';
import { useToast } from '@/components/feedback';
import { AUTH_COPY } from '@/modules/admin/authCopy';
import { formatBusinessTime } from '@/utils/format';
import { useSession } from './useSession';

/** How long before the cap the warning shows. */
const WARN_BEFORE_MS = 5 * 60_000;

export function useSessionCapWarning(): void {
  const { user, persistent, sessionExpiresAt } = useSession();
  const toast = useToast();
  const warnedFor = useRef<number | null>(null);
  const signedIn = user !== null;

  useEffect(() => {
    if (!signedIn || persistent || sessionExpiresAt === null || warnedFor.current === sessionExpiresAt) {
      return undefined;
    }
    const show = () => {
      // A timer that fired late (a sleeping laptop) must not warn about a cap that has already passed.
      if (Date.now() >= sessionExpiresAt) {
        return;
      }
      const time = formatBusinessTime(new Date(sessionExpiresAt).toISOString());
      if (time === null) {
        return;
      }
      warnedFor.current = sessionExpiresAt;
      toast.show({
        tone: 'warning',
        title: AUTH_COPY.toasts.sessionEnding.title,
        message: AUTH_COPY.toasts.sessionEnding.body(time),
      });
    };
    const delay = sessionExpiresAt - WARN_BEFORE_MS - Date.now();
    if (delay <= 0) {
      show();
      return undefined;
    }
    const handle = window.setTimeout(show, delay);
    return () => {
      window.clearTimeout(handle);
    };
  }, [signedIn, persistent, sessionExpiresAt, toast]);
}
