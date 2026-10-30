// The "Discard changes?" guard of the order forms (ORD-15, D-57; plan 08-13). While `isDirty`, a move to another page inside the app
// (a link, Cancel, the sidebar, the tab bar, browser Back, the top bar search) is held, and the hook hands back what a ConfirmDialog
// needs: Keep Editing stays, Discard Changes lets the held move go through once. Reload, close and an outside link get the
// browser's own prompt through `beforeunload`.
//   - A clean form, a saved form and the sign-in page never prompt. After a save, call `allowLeave()` BEFORE navigating, or the
//     move to the saved order would be held by the form that was just saved (RESEARCH Pitfall 11).
//   - `useBlocker` needs a data router, so the forms render under createBrowserRouter or createMemoryRouter.
import { useCallback, useRef } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router';

/** Signing out ends on this path; it must never be held. */
const SIGN_IN_PATH = '/admin/login';

export interface UnsavedChangesOptions {
  /** Any field, or any item row, differs from what the form opened with. */
  isDirty: boolean;
  /** Another path that may be left for without asking. The sign-in page is always allowed. */
  allow?: ((pathname: string) => boolean) | undefined;
}

export interface UnsavedChangesDialog {
  /** A move is held and the dialog should show. */
  open: boolean;
  /** Keep Editing: drops the held move. */
  onKeepEditing: () => void;
  /** Discard Changes: lets the held move go through. Pressed twice, it still moves once. */
  onDiscard: () => void;
}

export interface UnsavedChangesGuard {
  /** Call before navigating away on purpose (after a save): nothing is held from then on. */
  allowLeave: () => void;
  dialog: UnsavedChangesDialog;
}

function isSignIn(pathname: string): boolean {
  return pathname === SIGN_IN_PATH || pathname.startsWith(`${SIGN_IN_PATH}/`);
}

export function useUnsavedChangesGuard({ isDirty, allow }: UnsavedChangesOptions): UnsavedChangesGuard {
  // Set right before a deliberate navigation, so the form that was just saved does not hold it.
  const leaving = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty &&
      !leaving.current &&
      currentLocation.pathname !== nextLocation.pathname &&
      !isSignIn(nextLocation.pathname) &&
      allow?.(nextLocation.pathname) !== true,
  );
  useBeforeUnload(
    useCallback(
      (event) => {
        if (isDirty && !leaving.current) {
          event.preventDefault();
        }
      },
      [isDirty],
    ),
  );
  return {
    allowLeave: () => {
      leaving.current = true;
    },
    dialog: {
      open: blocker.state === 'blocked',
      onKeepEditing: () => {
        if (blocker.state === 'blocked') {
          blocker.reset();
        }
      },
      onDiscard: () => {
        if (blocker.state === 'blocked') {
          blocker.proceed();
        }
      },
    },
  };
}
