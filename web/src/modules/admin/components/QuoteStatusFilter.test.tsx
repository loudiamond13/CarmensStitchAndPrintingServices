import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { QuoteStatusFilter as Status } from '@/modules/admin/services/quoteRequestsService';
import { expectNoAxeViolations } from '@/test/axe';
import { QUOTE_COUNTS } from '@/test/quoteRequestFixtures';
import { QuoteStatusFilter } from './QuoteStatusFilter';

// The R1 status pills (UI-SPEC R1 item 2, D-18): a toolbar named "Show" with roving focus, as the Gallery pills.

/** The bar between two plain buttons, so a Tab can enter and leave it. */
function renderBar(selected: Status = 'open', counts: typeof QUOTE_COUNTS | null = QUOTE_COUNTS) {
  const onSelect = vi.fn<(status: Status) => void>();
  const view = render(
    <>
      <button type="button">Before</button>
      <QuoteStatusFilter selected={selected} counts={counts ?? undefined} onSelect={onSelect} />
      <button type="button">After</button>
    </>,
  );
  return { ...view, onSelect };
}

const pill = (name: string) => screen.getByRole('button', { name });

describe('QuoteStatusFilter', () => {
  it('is a toolbar named "Show" with the five pills and their server counts', () => {
    renderBar();

    const toolbar = screen.getByRole('toolbar', { name: 'Show' });
    expect(
      within(toolbar)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Open 4 requests', 'Converted 12 requests', 'Closed 3 requests', 'Spam 1 requests', 'All 20 requests']);
  });

  it('shows the pills without counts until the first answer', () => {
    renderBar('open', null);

    expect(
      within(screen.getByRole('toolbar', { name: 'Show' }))
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Open', 'Converted', 'Closed', 'Spam', 'All']);
  });

  it('marks the selected pill pressed and maroon, and every pill 44px tall', () => {
    renderBar('spam');

    expect(pill('Spam 1 requests')).toHaveAttribute('aria-pressed', 'true');
    expect(pill('Spam 1 requests')).toHaveClass('bg-primary');
    expect(pill('Open 4 requests')).toHaveAttribute('aria-pressed', 'false');
    expect(pill('Open 4 requests')).not.toHaveClass('bg-primary');
    for (const button of within(screen.getByRole('toolbar')).getAllByRole('button')) {
      expect(button).toHaveClass('min-h-11');
    }
  });

  it('has one tab stop: Tab enters on the selected pill and the next Tab leaves the bar', async () => {
    renderBar('closed');
    const user = userEvent.setup();

    await user.tab();
    await user.tab();
    expect(pill('Closed 3 requests')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
  });

  it('moves focus with the arrow keys, wrapping at both ends, and selects nothing', async () => {
    const { onSelect } = renderBar();
    const user = userEvent.setup();
    pill('All 20 requests').focus();

    await user.keyboard('{ArrowRight}');
    expect(pill('Open 4 requests')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(pill('All 20 requests')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(pill('Spam 1 requests')).toHaveFocus();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('jumps to the first pill with Home and to the last with End', async () => {
    renderBar();
    const user = userEvent.setup();
    pill('Closed 3 requests').focus();

    await user.keyboard('{End}');
    expect(pill('All 20 requests')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(pill('Open 4 requests')).toHaveFocus();
  });

  it('selects the focused pill with Enter or Space, and a click selects too', async () => {
    const { onSelect } = renderBar();
    const user = userEvent.setup();
    pill('Open 4 requests').focus();

    await user.keyboard('{ArrowRight}{Enter}');
    expect(onSelect).toHaveBeenLastCalledWith('converted');
    await user.keyboard('{ArrowRight}{ArrowRight} ');
    expect(onSelect).toHaveBeenLastCalledWith('spam');
    await user.click(pill('All 20 requests'));
    expect(onSelect).toHaveBeenLastCalledWith('all');
  });

  it('has no axe violations', async () => {
    const { container } = renderBar('spam');

    await expectNoAxeViolations(container);
  });
});
