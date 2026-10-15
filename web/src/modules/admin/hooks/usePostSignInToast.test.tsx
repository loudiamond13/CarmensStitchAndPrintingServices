// The toast a sign-in screen leaves for the shell shows once (plan 04-31).
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { setSignedInToast, takeSignedInToast } from '@/modules/admin/services/session';
import { usePostSignInToast } from './usePostSignInToast';

function Probe() {
  usePostSignInToast();
  return <p>shell</p>;
}

function renderShell() {
  return render(
    <ToastProvider>
      <Probe />
    </ToastProvider>,
  );
}

beforeEach(() => {
  takeSignedInToast();
});

describe('usePostSignInToast', () => {
  it('shows "Password saved" once when the must-change step left it', () => {
    setSignedInToast('password-saved');

    renderShell();

    expect(screen.getByText('Password saved')).toBeInTheDocument();
    expect(screen.getByText("You're signed in. Use your new password next time.")).toBeInTheDocument();
    expect(takeSignedInToast()).toBeNull();
  });

  it('shows nothing when no screen left a toast', () => {
    renderShell();

    expect(screen.queryByText('Password saved')).not.toBeInTheDocument();
  });
});
