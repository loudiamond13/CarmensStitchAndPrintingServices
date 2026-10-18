import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CopyField } from '@/modules/admin/components/CopyField';
import { expectNoAxeViolations } from '@/test/axe';

// CopyField (SPEC-GAP, plan 05-22; UI-SPEC "CopyField behaviour", D-14): the shown-once password in a read-only field with a
// Copy Password button. The value is never logged, stored or shown anywhere else.

const VALUE = 'Tela-Sukat-7381';
const FAILED = "Copy didn't work. Select the password and copy it yourself.";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const field = () => screen.getByLabelText<HTMLInputElement>('Temporary password for Ana');

describe('CopyField', () => {
  it('holds the value in a read-only text field named by its label, with a Copy Password button', () => {
    render(<CopyField label="Temporary password for Ana" value={VALUE} />);

    expect(field()).toHaveValue(VALUE);
    expect(field()).toHaveAttribute('readonly');
    expect(field()).toHaveAttribute('type', 'text');
    expect(field()).toHaveAttribute('autocomplete', 'off');
    expect(screen.getByRole('button', { name: 'Copy Password' })).toBeInTheDocument();
  });

  it('shows the value in the field only, never as text anywhere else', () => {
    render(<CopyField label="Temporary password for Ana" value={VALUE} />);

    expect(screen.queryByText(VALUE)).toBeNull();
    expect(screen.getAllByDisplayValue(VALUE)).toHaveLength(1);
  });

  it('focuses the field on mount when asked to', () => {
    render(<CopyField label="Temporary password for Ana" value={VALUE} focusOnMount />);

    expect(field()).toHaveFocus();
  });

  it('copies the value, reads "Copied" with a polite "Password copied." for 2 seconds, then goes back', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    render(<CopyField label="Temporary password for Ana" value={VALUE} />);

    await user.click(screen.getByRole('button', { name: 'Copy Password' }));

    expect(writeText).toHaveBeenCalledExactlyOnceWith(VALUE);
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Password copied.');
    expect(screen.queryByText(FAILED)).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(screen.getByRole('button', { name: 'Copy Password' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('selects the text and shows the failure message when the clipboard refuses', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    render(<CopyField label="Temporary password for Ana" value={VALUE} />);

    await user.click(screen.getByRole('button', { name: 'Copy Password' }));

    expect(await screen.findByText(FAILED)).toBeInTheDocument();
    expect(field().selectionStart).toBe(0);
    expect(field().selectionEnd).toBe(VALUE.length);
    expect(screen.getByRole('button', { name: 'Copy Password' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('takes a missing clipboard as a failure', async () => {
    const user = userEvent.setup();
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    try {
      render(<CopyField label="Temporary password for Ana" value={VALUE} />);

      await user.click(screen.getByRole('button', { name: 'Copy Password' }));

      expect(await screen.findByText(FAILED)).toBeInTheDocument();
    } finally {
      if (original !== undefined) {
        Object.defineProperty(navigator, 'clipboard', original);
      }
    }
  });

  it('clears the failure message after a later copy that works', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('denied'));
    writeText.mockResolvedValue(undefined);
    render(<CopyField label="Temporary password for Ana" value={VALUE} />);
    await user.click(screen.getByRole('button', { name: 'Copy Password' }));
    await screen.findByText(FAILED);

    await user.click(screen.getByRole('button', { name: 'Copy Password' }));

    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(screen.queryByText(FAILED)).toBeNull();
  });

  it('never logs the value', async () => {
    const user = userEvent.setup();
    const logs = [
      vi.spyOn(console, 'log'),
      vi.spyOn(console, 'info'),
      vi.spyOn(console, 'error'),
      vi.spyOn(console, 'warn'),
    ];
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    render(<CopyField label="Temporary password for Ana" value={VALUE} />);

    await user.click(screen.getByRole('button', { name: 'Copy Password' }));
    await screen.findByRole('button', { name: 'Copied' });

    expect(
      logs
        .flatMap((log) => log.mock.calls)
        .flat()
        .join(' '),
    ).not.toContain(VALUE);
  });

  it('has no axe violations, also after a failed copy', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    const { container } = render(<CopyField label="Temporary password for Ana" value={VALUE} />);
    await expectNoAxeViolations(container);

    await user.click(screen.getByRole('button', { name: 'Copy Password' }));
    await screen.findByText(FAILED);

    await expectNoAxeViolations(container);
  });
});
