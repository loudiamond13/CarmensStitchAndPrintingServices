import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { buttonClasses } from '@/components/actions';
import { ConflictBanner, STATES_COPY } from '@/components/states';

function tokens(classes: string | null | undefined): string[] {
  return (classes ?? '').split(/\s+/).filter(Boolean).sort();
}

// ConflictBanner (SPEC-GAP, plan 05-13; UI-SPEC "ConflictBanner" and Interaction Contract "Stale save (409)"; D-20, SEC-07):
// the shared banner every aggregate form shows after a 409. It tells the person what happened and offers Load Latest. It
// never clears anything itself: the form decides what happens to the typed values.

describe('ConflictBanner', () => {
  it('is an alert with the bold line, the muted line and a Load Latest button', () => {
    render(<ConflictBanner onLoadLatest={() => undefined} />);

    const alert = screen.getByRole('alert');
    expect(within(alert).getByText('This was changed by someone else.').tagName).toBe('STRONG');
    expect(
      within(alert).getByText('Reload and try again. Your typed changes stay here until you press Load Latest.'),
    ).toBeInTheDocument();
    expect(within(alert).getByRole('button', { name: 'Load Latest' })).toBeInTheDocument();
  });

  it('puts focus on Load Latest when it appears', () => {
    render(<ConflictBanner onLoadLatest={() => undefined} />);

    expect(screen.getByRole('button', { name: 'Load Latest' })).toHaveFocus();
  });

  it('calls onLoadLatest once per press and nothing else', async () => {
    const onLoadLatest = vi.fn();
    render(<ConflictBanner onLoadLatest={onLoadLatest} />);

    await userEvent.click(screen.getByRole('button', { name: 'Load Latest' }));

    expect(onLoadLatest).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('reads "Loading" while pending, keeps focus on the button, and ignores presses', async () => {
    const onLoadLatest = vi.fn();
    render(<ConflictBanner onLoadLatest={onLoadLatest} pending />);

    const button = screen.getByRole('button', { name: 'Loading' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveFocus();
    await userEvent.click(button);
    expect(onLoadLatest).not.toHaveBeenCalled();
  });

  it('is the danger banner with the icon and text at the top: a 20px triangle-alert, the two lines, then the secondary sm button', () => {
    render(<ConflictBanner onLoadLatest={() => undefined} />);

    const banner = screen.getByRole('alert');
    expect(banner.className).toContain('items-start');
    expect(banner.className).toContain('bg-danger-soft');
    const icon = banner.firstElementChild;
    expect(icon).toHaveClass('lucide-triangle-alert');
    expect(icon).toHaveAttribute('width', '20');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    const button = screen.getByRole('button', { name: 'Load Latest' });
    expect(tokens(button.className)).toEqual(tokens(buttonClasses({ variant: 'secondary', size: 'sm' })));
    expect(button).toHaveAttribute('type', 'button');
    expect(banner.lastElementChild).toBe(button);
  });

  it('keeps its words in the one states copy module', () => {
    expect(STATES_COPY.conflict.title).toBe('This was changed by someone else.');
    expect(STATES_COPY.conflict.body).toBe(
      'Reload and try again. Your typed changes stay here until you press Load Latest.',
    );
    expect(STATES_COPY.conflict.loadLatest).toBe('Load Latest');
    expect(STATES_COPY.conflict.loading).toBe('Loading');
    expect(STATES_COPY.conflict.loaded).toBe('Latest version loaded. Make your changes again.');
  });

  it('has no axe violations', async () => {
    const { container } = render(<ConflictBanner onLoadLatest={() => undefined} />);

    await expectNoAxeViolations(container);
  });
});
