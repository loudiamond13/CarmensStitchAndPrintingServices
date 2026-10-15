import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { AuthCard, type AuthCardName } from './previews/AuthScreens';
import { DevicesScreen } from './previews/SessionScreens';

// The sign-in card previews (plan 04-32): the Component Showcase draws every card on one page, so no card may take the
// keyboard focus on its own (the real screens move focus to their heading; the previews must not).

const CARDS: readonly AuthCardName[] = [
  'signin-notice',
  'signin-banner',
  'verify',
  'verify-error',
  'verify-waiting',
  'verify-cap',
  'new-password-temporary',
  'new-password-breach',
  'forgot-form',
  'forgot-sent',
  'reset-checking',
  'reset-form',
  'reset-invalid',
  'invite-checking',
  'invite-form',
  'invite-invalid',
  'invite-fail-closed',
];

function renderCard(card: AuthCardName) {
  return render(
    <MemoryRouter>
      <AuthCard card={card} />
    </MemoryRouter>,
  );
}

describe('AuthCard previews', () => {
  it.each(CARDS)('%s takes no focus on its own and shows its title as an h2', (card) => {
    renderCard(card);

    expect(document.body).toHaveFocus();
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(0);
  });

  it.each(CARDS)('%s has no axe violations', async (card) => {
    const { container } = renderCard(card);

    await expectNoAxeViolations(container);
  });
});

describe('DevicesScreen previews', () => {
  it.each(['loading', 'error', 'only-this-device', 'populated'] as const)(
    '%s takes no focus and has an h2 title',
    (state) => {
      render(<DevicesScreen state={state} />);

      expect(document.body).toHaveFocus();
      expect(screen.getByRole('heading', { level: 2, name: 'Signed-in devices' })).toBeInTheDocument();
    },
  );

  it('shows a 60-character device label and two rows with the same label', () => {
    render(<DevicesScreen state="populated" />);

    expect(screen.getByText('Samsung Internet on Galaxy Tab S9 Ultra at the front counter')).toBeInTheDocument();
    expect(screen.getAllByText('Edge on Windows')).toHaveLength(2);
  });
});
