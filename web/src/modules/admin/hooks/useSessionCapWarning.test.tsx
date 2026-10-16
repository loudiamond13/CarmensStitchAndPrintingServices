// The OQ-4 warning (WCAG 2.2.1): a browser-session sign-in gets a persistent warning toast 5 minutes before the 12-hour
// cap. A "Keep me signed in" session (90 days) never gets it. Timers are faked; the clock is set per test.
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { sessionResponse } from '@/test/sessionFixtures';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { useSessionCapWarning } from './useSessionCapWarning';

const CAP = '2026-10-14T07:42:00Z';
const FIVE_MINUTES = 5 * 60_000;

function Probe() {
  useSessionCapWarning();
  return <p>shell</p>;
}

function renderShell() {
  return render(
    <ToastProvider>
      <Probe />
    </ToastProvider>,
  );
}

/** Signs in at `now` with a session that ends at `CAP`. */
function signIn(now: string, persistent = false): void {
  vi.setSystemTime(new Date(now));
  act(() => {
    acceptSession(sessionResponse({ persistent, sessionExpiresAt: CAP }, Date.parse(now)));
  });
}

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

const TITLE = 'Your session ends soon';
const BODY = "You'll be signed out at 3:42 PM. Save your work, then sign in again.";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
});

afterEach(() => {
  act(() => {
    clearSession();
  });
  vi.useRealTimers();
});

describe('useSessionCapWarning (OQ-4)', () => {
  it('shows one warning toast five minutes before the cap, in business time', () => {
    renderShell();
    signIn('2026-10-13T19:42:00Z');

    advance(12 * 3_600_000 - FIVE_MINUTES - 1000);
    expect(screen.queryByText(TITLE)).toBeNull();

    advance(1000);
    expect(screen.getByText(TITLE)).toBeInTheDocument();
    expect(screen.getByText(BODY)).toBeInTheDocument();
    expect(screen.getAllByText(TITLE)).toHaveLength(1);
  });

  it('keeps the warning until it is closed (a warning toast persists)', () => {
    renderShell();
    signIn('2026-10-14T07:36:00Z');
    advance(0);
    expect(screen.queryByText(TITLE)).toBeNull();

    advance(60_000);
    expect(screen.getByText(TITLE)).toBeInTheDocument();
    advance(60_000);
    expect(screen.getByText(TITLE)).toBeInTheDocument();
  });

  it('never warns a session that was kept signed in (90 days)', () => {
    renderShell();
    signIn('2026-10-13T19:42:00Z', true);

    advance(13 * 3_600_000);

    expect(screen.queryByText(TITLE)).toBeNull();
  });

  it('cancels the timer when the user signs out', () => {
    renderShell();
    signIn('2026-10-13T19:42:00Z');
    advance(3_600_000);

    act(() => {
      clearSession();
    });
    advance(12 * 3_600_000);

    expect(screen.queryByText(TITLE)).toBeNull();
  });

  it('warns at once when the session is already within five minutes of the cap', () => {
    renderShell();

    signIn('2026-10-14T07:39:00Z');
    advance(0);

    expect(screen.getByText(TITLE)).toBeInTheDocument();
    expect(screen.getByText(BODY)).toBeInTheDocument();
  });

  it('does not warn again when a refresh brings the same cap', () => {
    renderShell();
    signIn('2026-10-14T07:38:00Z');
    advance(0);
    expect(screen.getAllByText(TITLE)).toHaveLength(1);

    signIn('2026-10-14T07:39:00Z');
    advance(0);

    expect(screen.getAllByText(TITLE)).toHaveLength(1);
  });

  it('does not warn about a cap that has already passed', () => {
    renderShell();

    signIn('2026-10-14T07:50:00Z');
    advance(0);

    expect(screen.queryByText(TITLE)).toBeNull();
  });

  it('shows nothing while nobody is signed in', () => {
    renderShell();

    advance(24 * 3_600_000);

    expect(screen.queryByText(TITLE)).toBeNull();
  });
});
