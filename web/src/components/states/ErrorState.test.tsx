import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { kit } from '@/dev/kit';
import { renderNode } from '@/dev/renderScenario';
import { scenarios as statesScenarios } from '@/dev/scenarios/groups/states';
import { HttpError } from '@/core/api/errors';
import { describeHttpError } from '@/utils/describeHttpError';
import { expectNoAxeViolations } from '@/test/axe';
import { buttonClasses } from '@/components/actions';
import { ErrorState, STATES_COPY } from '@/components/states';

// ErrorState (SPEC-GAP, plan 02-28; UI-SPEC "SPEC-GAP Primitive Specs" → ErrorState, App. E.8 "Couldn't load",
// Copywriting "Error state"; WEB-06, A11Y-01, T-02-62). A failed list load tells staff what happened, gives the
// support reference and lets them retry. Only approved copy shows; the traceId reference is the one server value.
// user-event and axe on real timers (L-24).

function tokens(classes: string | null | undefined): string[] {
  return (classes ?? '').split(/\s+/).filter(Boolean).sort();
}

// App. C `.s-banner` + `.s-banner.is-danger` (+ its `strong` and `span` rules), with App. E.8's inline
// `align-items: center`: flex, gap 12, padding 12/16, radius 8, 14px/20px, --danger-soft fill, --danger text and a
// 1px border of --danger mixed 40% into transparent (in srgb, as written).
const BANNER =
  'flex items-center gap-3 rounded-sm border border-[color-mix(in_srgb,var(--danger)_40%,transparent)] bg-danger-soft px-4 py-3 text-[14px] leading-5 text-danger [&_span]:text-ink-muted [&_strong]:block [&_strong]:text-ink';
// App. E.8's `<div style="flex: 1">` around the two lines; it may shrink and wraps a long traceId anywhere, so Try
// Again stays inside the banner at 320px (the parity run's axe pass caught the overflow).
const BANNER_TEXT = 'min-w-0 flex-1 wrap-anywhere';

const BODY = 'Check your internet connection. Your data is safe. Nothing was changed.';
const TRACE = '00-4bf92f3577b34da6a3ce929d0e0e4736-01';

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

function textOf(banner: HTMLElement): HTMLElement {
  const text = banner.children[1];
  if (!(text instanceof HTMLElement)) {
    throw new Error('the banner has no text column');
  }
  return text;
}

describe('ErrorState tracer (App. E.8)', () => {
  it('a failed orders load shows the alert banner with its trace reference, and Try Again refetches', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn<() => void>();
    const { container } = render(<ErrorState things="orders" error={httpError(500, 'abc123')} onRetry={onRetry} />);
    const banner = screen.getByRole('alert');
    expect(banner.querySelector('strong')?.textContent).toBe("Couldn't load orders.");
    expect(textOf(banner).querySelector('span')?.textContent).toBe(`${BODY} Reference: abc123`);
    await user.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    await expectNoAxeViolations(container);
  });
});

describe('ErrorState markup and look (App. C .s-banner.is-danger)', () => {
  it('is the centred danger banner: a 20px triangle-alert, the bold and muted lines, then the secondary sm Try Again', () => {
    render(<ErrorState things="orders" onRetry={vi.fn()} />);
    const banner = screen.getByRole('alert');
    expect(tokens(banner.className)).toEqual(tokens(BANNER));
    const icon = banner.firstElementChild;
    expect(icon?.tagName.toLowerCase()).toBe('svg');
    expect(icon).toHaveClass('lucide-triangle-alert');
    expect(icon).toHaveAttribute('width', '20');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    const text = textOf(banner);
    expect(tokens(text.className)).toEqual(tokens(BANNER_TEXT));
    expect(text.querySelector('strong')?.textContent).toBe("Couldn't load orders.");
    expect(text.querySelector('span')?.textContent).toBe(BODY);
    const retry = screen.getByRole('button', { name: 'Try Again' });
    expect(tokens(retry.className)).toEqual(tokens(buttonClasses({ variant: 'secondary', size: 'sm' })));
    expect(retry).toHaveAttribute('type', 'button');
    expect(banner.lastElementChild).toBe(retry);
    expect(banner.children).toHaveLength(3);
  });

  it('uses the Copywriting strings from the one copy module', () => {
    expect(STATES_COPY.error.loadFailedTitle('orders')).toBe("Couldn't load orders.");
    expect(STATES_COPY.error.loadFailedBody).toBe(BODY);
    expect(STATES_COPY.error.reference('abc123')).toBe('Reference: abc123');
    expect(STATES_COPY.error.retry).toBe('Try Again');
  });

  it('names the list it failed to load', () => {
    render(<ErrorState things="expenses" />);
    expect(screen.getByRole('alert').querySelector('strong')?.textContent).toBe("Couldn't load expenses.");
  });

  it('has no axe violations', async () => {
    const { container } = render(<ErrorState things="orders" error={httpError(500, 'abc123')} onRetry={vi.fn()} />);
    await expectNoAxeViolations(container);
  });
});

describe('ErrorState reference and copy (T-02-62, CWE-209)', () => {
  it('has no "Reference:" without a traceId', () => {
    render(<ErrorState things="orders" error={httpError(503)} />);
    expect(screen.getByRole('alert').textContent).not.toContain('Reference:');
  });

  it('ends the second line with "Reference: {traceId}" for an HttpError that has one', () => {
    render(<ErrorState things="orders" error={httpError(500, TRACE)} />);
    expect(textOf(screen.getByRole('alert')).querySelector('span')?.textContent).toBe(`${BODY} Reference: ${TRACE}`);
  });

  it('shows only the approved copy, never the server title or detail', () => {
    render(<ErrorState things="orders" error={httpError(500, 'abc123')} />);
    const text = screen.getByRole('alert').textContent;
    expect(text).not.toContain('SELECT');
    expect(text).not.toContain('Csps.Server');
  });

  it('still renders the generic copy for an error that is not an HttpError', () => {
    render(<ErrorState things="orders" error={new TypeError('Failed to fetch')} />);
    const banner = screen.getByRole('alert');
    expect(banner.querySelector('strong')?.textContent).toBe("Couldn't load orders.");
    expect(textOf(banner).querySelector('span')?.textContent).toBe(BODY);
  });

  it('takes the shared mapper copy for a modal-level banner (describeHttpError)', async () => {
    const error = httpError(409, 'tr-409');
    const copy = describeHttpError(error);
    const { container } = render(<ErrorState title={copy?.title ?? ''} message={copy?.body ?? ''} error={error} />);
    const banner = screen.getByRole('alert');
    expect(banner.querySelector('strong')?.textContent).toBe('Someone else changed this');
    expect(textOf(banner).querySelector('span')?.textContent).toBe(
      'Reload to see the latest version, then make your change again. Reference: tr-409',
    );
    await expectNoAxeViolations(container);
  });

  it('leaves out an empty second line (a 400 with field errors) unless there is a reference', () => {
    const error = httpError(400, undefined, { Email: ['Enter a valid email.'] });
    const copy = describeHttpError(error);
    const { rerender } = render(<ErrorState title={copy?.title ?? ''} message={copy?.body ?? ''} error={error} />);
    const banner = screen.getByRole('alert');
    expect(banner.querySelector('strong')?.textContent).toBe('Check the highlighted fields.');
    expect(textOf(banner).querySelector('span')).toBeNull();
    const traced = httpError(400, 'tr-400', { Email: ['Enter a valid email.'] });
    rerender(<ErrorState title="Check the highlighted fields." message="" error={traced} />);
    expect(textOf(screen.getByRole('alert')).querySelector('span')?.textContent).toBe('Reference: tr-400');
  });

  it('does not repeat a reference the message already carries (the 5xx mapper copy)', () => {
    const error = httpError(500, 'tr-500');
    const copy = describeHttpError(error);
    render(<ErrorState title={copy?.title ?? ''} message={copy?.body ?? ''} error={error} />);
    expect(textOf(screen.getByRole('alert')).querySelector('span')?.textContent).toBe(
      'Please try again. Reference: tr-500',
    );
  });
});

describe('ErrorState retry', () => {
  it('calls onRetry once per click', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn<() => void>();
    render(<ErrorState things="orders" onRetry={onRetry} />);
    const retry = screen.getByRole('button', { name: 'Try Again' });
    await user.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
    await user.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('runs from the keyboard', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn<() => void>();
    render(<ErrorState things="orders" onRetry={onRetry} />);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Try Again' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('has no Try Again when there is nothing to retry', () => {
    render(<ErrorState things="orders" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('alert').children).toHaveLength(2);
  });
});

describe('ErrorState re-render (React Compiler cache)', () => {
  it('keeps its markup when re-rendered with equal props, and updates on new props', () => {
    const onRetry = vi.fn<() => void>();
    const error = httpError(500, 'abc123');
    const { container, rerender } = render(<ErrorState things="orders" error={error} onRetry={onRetry} />);
    const before = container.innerHTML;
    rerender(<ErrorState things="orders" error={error} onRetry={onRetry} />);
    expect(container.innerHTML).toBe(before);
    rerender(<ErrorState title="Not found" message="It may have been deleted." error={error} />);
    const custom = container.innerHTML;
    expect(custom).not.toBe(before);
    rerender(<ErrorState title="Not found" message="It may have been deleted." error={error} />);
    expect(container.innerHTML).toBe(custom);
    rerender(<ErrorState title="Not found" />);
    expect(textOf(screen.getByRole('alert')).querySelector('span')).toBeNull();
  });
});

describe('error scenarios (the states group)', () => {
  const ids = ['error-state-orders', 'error-state-trace'];
  const cases = statesScenarios.filter((scenario) => ids.includes(scenario.id));

  it('declares them implementation only, at rest and with keyboard focus on Try Again, both themes, every width', () => {
    expect(cases.map((scenario) => scenario.id)).toEqual(ids);
    for (const scenario of cases) {
      expect(scenario.group, scenario.id).toBe('states');
      expect(scenario.parity, scenario.id).toBe(false);
      expect(scenario.responsive, scenario.id).toBe(true);
      expect(scenario.states, scenario.id).toEqual(['rest', 'focus-visible']);
      expect(scenario.themes, scenario.id).toEqual(['light', 'dark']);
      expect(scenario.target, scenario.id).toBe('button');
      expect(scenario.handlers, scenario.id).toEqual(['onRetry']);
    }
  });

  it('renders them through the implementation kit with the approved copy and the reference, no axe violations', async () => {
    const { container } = render(
      <div>
        {cases.map((scenario) => (
          <div key={scenario.id} data-case={scenario.id}>
            {renderNode(kit, scenario.node, scenario.handlers ?? [])}
          </div>
        ))}
      </div>,
    );
    const banners = screen.getAllByRole('alert');
    expect(banners).toHaveLength(2);
    expect(banners.map((banner) => banner.querySelector('strong')?.textContent)).toEqual([
      STATES_COPY.error.loadFailedTitle('orders'),
      STATES_COPY.error.loadFailedTitle('orders'),
    ]);
    expect(banners.map((banner) => textOf(banner).querySelector('span')?.textContent)).toEqual([
      BODY,
      `${BODY} ${STATES_COPY.error.reference(TRACE)}`,
    ]);
    expect(screen.getAllByRole('button', { name: STATES_COPY.error.retry })).toHaveLength(2);
    expect(container.textContent).not.toContain('SELECT');
    await expectNoAxeViolations(container);
  });
});
