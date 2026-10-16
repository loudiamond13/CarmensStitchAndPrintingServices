import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { LoginScreen } from './previews/LoginScreen';

// The S1 parity preview (plan 04-32): the real AuthFrame around the real SignInForm, with the App. E.5 values.

function renderScreen(state?: 'default' | 'error' | 'loading') {
  return render(
    <MemoryRouter>
      <LoginScreen {...(state === undefined ? {} : { state })} />
    </MemoryRouter>,
  );
}

describe('LoginScreen preview (App. E.5)', () => {
  it('shows the default state: the e-mail filled, the password empty, Keep me signed in unticked (D-03)', () => {
    renderScreen();

    expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('paolo.garcia@gmail.com');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getByRole('checkbox', { name: 'Keep me signed in' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the error state: the generic banner and a filled password', () => {
    renderScreen('error');

    expect(screen.getByRole('alert')).toHaveTextContent('Email or password is incorrect.');
    expect(screen.getByLabelText('Password')).toHaveValue('tahi2026');
  });

  it('shows the loading state: the pending button reads Signing in', () => {
    renderScreen('loading');

    expect(screen.getByRole('button', { name: 'Signing in' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByLabelText('Password')).toHaveValue('tahi2026');
  });

  it('holds the frame at the mockup height of 960px', () => {
    const { container } = renderScreen();

    expect(container.querySelector<HTMLElement>('main')?.parentElement?.style.getPropertyValue('--login-h')).toBe(
      '960px',
    );
  });

  it('has no axe violations in any state', async () => {
    for (const state of ['default', 'error', 'loading'] as const) {
      const { container, unmount } = renderScreen(state);
      await expectNoAxeViolations(container);
      unmount();
    }
  });
});
