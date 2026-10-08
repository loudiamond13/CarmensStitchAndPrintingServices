// WEB-06, A11Y-01, T-02-37 (02-UI-SPEC SPEC-GAP "ErrorState"; App. E.8; Copywriting "Error state"): the danger banner
// for a failed load. Only approved copy shows; the traceId reference is the one server value.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '@/lib/api';
import { describeHttpError } from '@/lib/errors/describeHttpError';
import { expectNoAxeViolations } from '@/test/axe';
import { ErrorState } from './ErrorState';

function httpError(status: number, traceId?: string, errors: Record<string, string[]> = {}): HttpError {
  return new HttpError({
    kind: 'http',
    status,
    problem: {
      type: undefined,
      title: 'Server says: SELECT * FROM Orders failed',
      status,
      detail: 'at Csps.Server.Orders.Handler line 42',
      instance: undefined,
      traceId,
      errors,
    },
  });
}

const BODY = 'Check your internet connection. Your data is safe — nothing was changed.';

describe('ErrorState (App. E.8)', () => {
  it('renders .s-banner.is-danger[role=alert], centred, with a 20px triangle-alert, the bold and muted lines and Try Again', async () => {
    const { container } = render(<ErrorState things="orders" onRetry={vi.fn()} />);
    const banner = screen.getByRole('alert');
    expect(banner).toHaveClass('s-banner', 'is-danger');
    expect(banner.style.alignItems).toBe('center');
    const icon = banner.firstElementChild;
    expect(icon).toHaveClass('lucide-triangle-alert');
    expect(icon).toHaveAttribute('width', '20');
    const text = banner.children[1] as HTMLElement;
    expect(text.style.flex).toMatch(/^1/);
    expect(text.querySelector('strong')?.textContent).toBe("Couldn't load orders.");
    expect(text.querySelector('span')?.textContent).toBe(BODY);
    const retry = screen.getByRole('button', { name: 'Try Again' });
    expect(retry).toHaveClass('csp-btn-secondary', 'csp-btn-sm');
    expect(banner.lastElementChild).toBe(retry);
    await expectNoAxeViolations(container);
  });

  it('has no "Reference:" without a traceId', () => {
    render(<ErrorState things="orders" error={httpError(503)} />);
    expect(screen.getByRole('alert').textContent).not.toContain('Reference:');
  });

  it('ends the second line with "Reference: {traceId}" for an HttpError that has one', () => {
    render(<ErrorState things="orders" error={httpError(500, '00-4bf92f3577b34da6a3ce929d0e0e4736-01')} />);
    expect(screen.getByRole('alert').querySelector('span')?.textContent).toBe(
      `${BODY} Reference: 00-4bf92f3577b34da6a3ce929d0e0e4736-01`,
    );
  });

  it('shows only the approved copy, never the server title or detail (T-02-37)', () => {
    render(<ErrorState things="orders" error={httpError(500, 'abc123')} />);
    const text = screen.getByRole('alert').textContent;
    expect(text).not.toContain('SELECT');
    expect(text).not.toContain('Csps.Server');
  });

  it('still renders the generic copy for an error that is not an HttpError', () => {
    render(<ErrorState things="orders" error={new TypeError('Failed to fetch')} />);
    const banner = screen.getByRole('alert');
    expect(banner.querySelector('strong')?.textContent).toBe("Couldn't load orders.");
    expect(banner.querySelector('span')?.textContent).toBe(BODY);
  });

  it('calls onRetry once per click', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ErrorState things="orders" onRetry={onRetry} />);
    const retry = screen.getByRole('button', { name: 'Try Again' });
    await user.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
    await user.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('has no Try Again when there is nothing to retry', () => {
    render(<ErrorState things="orders" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('takes the shared mapper copy for a modal banner (describeHttpError)', async () => {
    const error = httpError(409, 'tr-409');
    const copy = describeHttpError(error);
    const { container } = render(<ErrorState title={copy?.title ?? ''} message={copy?.body ?? ''} error={error} />);
    const banner = screen.getByRole('alert');
    expect(banner.querySelector('strong')?.textContent).toBe('Someone else changed this');
    expect(banner.querySelector('span')?.textContent).toBe(
      'Reload to see the latest version, then make your change again. Reference: tr-409',
    );
    await expectNoAxeViolations(container);
  });

  it('skips an empty second line (a 400 with field errors) unless there is a reference', () => {
    const error = httpError(400, undefined, { Email: ['Enter a valid email.'] });
    const copy = describeHttpError(error);
    const { rerender } = render(<ErrorState title={copy?.title ?? ''} message={copy?.body ?? ''} error={error} />);
    const banner = screen.getByRole('alert');
    expect(banner.querySelector('strong')?.textContent).toBe('Check the highlighted fields.');
    expect(banner.querySelector('div > span')).toBeNull();
    const traced = httpError(400, 'tr-400', { Email: ['Enter a valid email.'] });
    rerender(<ErrorState title="Check the highlighted fields." message="" error={traced} />);
    expect(screen.getByRole('alert').querySelector('div > span')?.textContent).toBe('Reference: tr-400');
  });

  it('does not repeat a reference the message already carries (the 5xx mapper copy)', () => {
    const error = httpError(500, 'tr-500');
    const copy = describeHttpError(error);
    render(<ErrorState title={copy?.title ?? ''} message={copy?.body ?? ''} error={error} />);
    expect(screen.getByRole('alert').querySelector('span')?.textContent).toBe('Please try again. Reference: tr-500');
  });
});
