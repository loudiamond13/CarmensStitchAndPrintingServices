import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { scenarios as overlayScenarios } from '@/dev/scenarios/groups/overlays';
import { HttpError } from '@/core/api/errors';
import type { CascadeCounts } from '@/utils/csps';
import { expectNoAxeViolations } from '@/test/axe';
import { ToastProvider } from '@/components/feedback';
import { messageClasses } from '@/components/forms';
import { ConfirmDialog, Overlay, type ConfirmDialogProps } from '@/components/overlays';
import {
  cascadeClasses,
  cascadeCountClasses,
  cascadeFootClasses,
  cascadeItemClasses,
  cascadeLeadClasses,
  cascadeListClasses,
  confirmClasses,
  confirmColumnClasses,
  confirmIconClasses,
  confirmMessageClasses,
} from './overlays.recipe';

// The converted App. D.3 ConfirmDialog (plan 02-22, CSPS-UI-SPEC.md §6.5 and §9.3, WEB-06): the cascade box, the
// type-to-confirm field, one confirm per attempt while the action is pending (T-02-53), and the stay-open failure
// state with the describeHttpError copy (UI-SPEC "UI Considerations" → error | ConfirmDialog, T-02-54). The look is
// proven by the parity suite (`--grep @overlays`).

const ORDER = 'ORD-2026-0148';
const COUNTS: CascadeCounts = { items: 5, payments: 2, discounts: 1, expenses: 3, images: 4 };
const SENTENCE = 'This will also delete 5 items, 2 payments, 1 discount, 3 expenses, and 4 images.';

function tokens(classes: string): string[] {
  return classes.split(/\s+/).filter(Boolean).sort();
}

function classTokens(element: Element | null | undefined): string[] {
  return [...(element?.classList ?? [])].sort();
}

type ProblemDetails = NonNullable<HttpError['problem']>;

function problem(traceId: string): ProblemDetails {
  return {
    type: undefined,
    title: 'Internal Server Error',
    status: 500,
    detail: 'SqlException: deadlock on table Orders',
    instance: undefined,
    traceId,
    code: undefined,
    errors: {},
  };
}

function serverError(traceId = '00-4bf92f3577b34da6-01'): HttpError {
  return new HttpError({ kind: 'http', status: 500, problem: problem(traceId) });
}

/** A promise the test settles by hand. */
function deferred() {
  let resolve: (value: unknown) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<unknown>((resolveWith, rejectWith) => {
    resolve = resolveWith;
    reject = rejectWith;
  });
  return { promise, resolve, reject };
}

function DeleteOrder(props: Partial<ConfirmDialogProps>) {
  return (
    <ConfirmDialog
      title={`Delete order ${ORDER}?`}
      message="Brgy. San Roque Ballers · Juan Dela Cruz. The order will be permanently deleted along with everything inside it."
      counts={COUNTS}
      confirmText={ORDER}
      confirmLabel="Delete Order"
      {...props}
    />
  );
}

function deleteButton() {
  return screen.getByRole('button', { name: 'Delete Order' });
}

function confirmField() {
  return screen.getByRole('textbox', { name: `Type ${ORDER} to confirm` });
}

afterEach(() => {
  document.body.className = '';
});

describe('ConfirmDialog (App. D.3, WEB-06)', () => {
  it('is a modal dialog named by its title, with the App. D.3 default title and label', () => {
    render(<ConfirmDialog onCancel={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Delete this?' }).getAttribute('aria-modal')).toBe('true');
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeVisible();
  });

  it('renders the danger tile, the message and the cascade box with the sentence, the tally and the warning', () => {
    render(<DeleteOrder />);
    const dialog = screen.getByRole('dialog');

    const cascade = within(dialog).getByRole('alert');
    expect(classTokens(cascade)).toEqual(tokens(cascadeClasses));
    const [lead, list, foot] = [...cascade.children];
    expect(lead?.textContent).toBe(SENTENCE);
    expect(classTokens(lead)).toEqual(tokens(cascadeLeadClasses));
    expect(list?.localName).toBe('ul');
    expect(classTokens(list)).toEqual(tokens(cascadeListClasses));
    expect([...(list?.children ?? [])].map((item) => item.textContent)).toEqual([
      '5items',
      '2payments',
      '1discount',
      '3expenses',
      '4images',
    ]);
    expect(foot?.textContent).toBe("This can't be undone.");
    expect(classTokens(foot)).toEqual(tokens(cascadeFootClasses));

    const message = within(dialog).getByText(/permanently deleted/);
    expect(message.localName).toBe('p');
    expect(classTokens(message)).toEqual(tokens(confirmMessageClasses));
    const column = message.parentElement;
    expect(classTokens(column)).toEqual(tokens(confirmColumnClasses));
    const row = column?.parentElement;
    expect(classTokens(row)).toEqual(tokens(confirmClasses));
    const tile = row?.firstElementChild;
    expect(tile?.localName).toBe('span');
    expect(classTokens(tile)).toEqual(tokens(confirmIconClasses));
    expect(tile?.querySelector('svg')?.getAttribute('width')).toBe('22');
  });

  it('dims zero-count tiles and names one of a kind in the singular', () => {
    render(<DeleteOrder counts={{ items: 1, payments: 0 }} />);
    const items = [...screen.getByRole('list').children];

    expect(screen.getByRole('alert').firstElementChild?.textContent).toBe('This will also delete 1 item.');
    expect(items.map((item) => item.textContent)).toEqual(['1item', '0payments', '0discounts', '0expenses', '0images']);
    expect(classTokens(items[0])).toEqual(tokens(cascadeItemClasses));
    expect(classTokens(items[0]?.firstElementChild)).toEqual(tokens(cascadeCountClasses({ zero: false })));
    expect(classTokens(items[1]?.firstElementChild)).toEqual(tokens(cascadeCountClasses({ zero: true })));
  });

  it('shows no cascade box without counts, or when every count is zero', () => {
    const { rerender } = render(<DeleteOrder counts={undefined} />);
    expect(screen.queryByRole('alert')).toBeNull();

    rerender(<DeleteOrder counts={{}} />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText("This can't be undone.")).toBeNull();
  });

  it('keeps the danger button disabled until the trimmed text matches exactly', async () => {
    const user = userEvent.setup();
    render(<DeleteOrder onConfirm={vi.fn()} />);

    expect(confirmField()).toHaveFocus();
    expect(deleteButton()).toBeDisabled();

    await user.type(confirmField(), 'ord-2026-0148');
    expect(deleteButton()).toBeDisabled();

    await user.clear(confirmField());
    await user.type(confirmField(), 'ORD-2026-014');
    expect(deleteButton()).toBeDisabled();

    await user.type(confirmField(), '8 ');
    expect(confirmField()).toHaveValue('ORD-2026-0148 ');
    expect(deleteButton()).toBeEnabled();
  });

  it('labels the type-to-confirm field with the text in bold', () => {
    render(<DeleteOrder />);

    expect(screen.getByText(ORDER, { selector: 'strong' })).toBeVisible();
    expect(confirmField().getAttribute('autocomplete')).toBe('off');
  });

  it('focuses Cancel on open when there is no type-to-confirm field (A11Y-02 empty edge)', () => {
    render(<DeleteOrder confirmText={undefined} counts={undefined} />);

    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(deleteButton()).toBeEnabled();
  });

  it('cancels from Cancel, Close and Esc', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<DeleteOrder onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledTimes(3);
  });

  it('runs a synchronous onConfirm once per click and stays as it was', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<DeleteOrder confirmText={undefined} onConfirm={onConfirm} />);

    await user.click(deleteButton());

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(deleteButton().getAttribute('aria-busy')).toBeNull();
  });

  it('runs onConfirm once per attempt: further confirms, Esc and Cancel are ignored while it is pending', async () => {
    const user = userEvent.setup();
    const action = deferred();
    const onConfirm = vi.fn(() => action.promise);
    const onCancel = vi.fn();
    render(<DeleteOrder onConfirm={onConfirm} onCancel={onCancel} />);
    await user.type(confirmField(), ORDER);

    await user.click(deleteButton());
    await user.click(deleteButton());
    await user.keyboard('{Enter}');
    fireEvent.click(deleteButton());
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    expect(deleteButton().getAttribute('aria-disabled')).toBe('true');
    expect(deleteButton().getAttribute('aria-busy')).toBe('true');

    await act(async () => {
      action.resolve({ ok: true, value: undefined });
      await action.promise;
    });
    expect(deleteButton().getAttribute('aria-busy')).toBeNull();
    expect(screen.queryByText(/Something went wrong/)).toBeNull();
  });

  it('stays open after a failure with the typed text, the mapped error and the traceId, Delete enabled and focused', async () => {
    const user = userEvent.setup();
    const action = deferred();
    const onConfirm = vi.fn(() => action.promise);
    render(
      <ToastProvider>
        <DeleteOrder onConfirm={onConfirm} onCancel={vi.fn()} />
      </ToastProvider>,
    );
    await user.type(confirmField(), ORDER);
    await user.click(deleteButton());

    await act(async () => {
      action.reject(serverError());
      await action.promise.catch(() => undefined);
    });

    expect(screen.getByRole('dialog')).toBeVisible();
    expect(confirmField()).toHaveValue(ORDER);
    const alerts = screen.getAllByRole('alert');
    const error = alerts.find((alert) => alert.localName === 'p');
    expect(error?.textContent).toBe('Something went wrong. Please try again. Reference: 00-4bf92f3577b34da6-01');
    expect(error?.textContent).not.toContain('SqlException');
    expect(classTokens(error)).toEqual(tokens(messageClasses({ error: true })));
    expect(error?.querySelector('svg')?.getAttribute('width')).toBe('14');
    expect(deleteButton()).toBeEnabled();
    expect(deleteButton().getAttribute('aria-disabled')).toBeNull();
    expect(deleteButton()).toHaveFocus();
    expect(screen.queryByRole('status')).toBeNull();
    expect(alerts.every((alert) => screen.getByRole('dialog').contains(alert))).toBe(true);
  });

  it('treats an onConfirm that throws before returning as a failure, stays open and allows a retry (UI-WR-06)', async () => {
    const user = userEvent.setup();
    const onConfirm = vi
      .fn<() => unknown>()
      .mockImplementationOnce(() => {
        throw new TypeError('order is undefined');
      })
      .mockImplementationOnce(() => undefined);
    render(<DeleteOrder onConfirm={onConfirm} />);
    await user.type(confirmField(), ORDER);

    await user.click(deleteButton());

    const failure = screen
      .getAllByRole('alert')
      .find((alert) => alert.localName === 'p' && alert.closest('[role="dialog"]'));
    expect(failure?.textContent).toMatch(/^Something went wrong/);
    expect(failure?.textContent).not.toContain('order is undefined');
    expect(deleteButton()).toBeEnabled();
    expect(deleteButton()).toHaveFocus();
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(deleteButton());
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it('places the error above the buttons, at the end of the text column', async () => {
    const user = userEvent.setup();
    render(<DeleteOrder onConfirm={() => Promise.reject(serverError())} />);
    await user.type(confirmField(), ORDER);
    await user.click(deleteButton());

    const error = await screen.findByText(/Reference:/);
    expect(error.parentElement?.lastElementChild).toBe(error);
    expect(error.parentElement).toBe(screen.getByText(/permanently deleted/).parentElement);
  });

  it('retries with a second onConfirm call, and closes on Esc again after a failure', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn(() => Promise.reject(serverError()));
    const onCancel = vi.fn();
    render(<DeleteOrder onConfirm={onConfirm} onCancel={onCancel} />);
    await user.type(confirmField(), ORDER);

    await user.click(deleteButton());
    await screen.findByText(/Reference:/);
    await user.click(deleteButton());
    await screen.findByText(/Reference:/);

    expect(onConfirm).toHaveBeenCalledTimes(2);
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('treats a resolved { ok: false } submission outcome as a failure (useSubmission)', async () => {
    const user = userEvent.setup();
    render(<DeleteOrder onConfirm={() => Promise.resolve({ ok: false, error: serverError('00-retry') })} />);
    await user.type(confirmField(), ORDER);

    await user.click(deleteButton());

    expect(await screen.findByText(/Reference: 00-retry/)).toBeVisible();
  });

  it('words a failure the caller recognises through describeFailure and leaves the rest to the mapper', async () => {
    const user = userEvent.setup();
    const guard = new Error('guard');
    const describeFailure = (error: unknown) =>
      error === guard ? { title: "You can't do this.", body: 'Try something else.' } : undefined;
    const onConfirm = vi
      .fn<() => Promise<unknown>>()
      .mockResolvedValueOnce({ ok: false, error: guard })
      .mockResolvedValueOnce({ ok: false, error: serverError('00-other') });
    render(<DeleteOrder onConfirm={onConfirm} describeFailure={describeFailure} />);
    await user.type(confirmField(), ORDER);

    await user.click(deleteButton());
    expect(await screen.findByText("You can't do this. Try something else.")).toBeVisible();
    await user.click(deleteButton());

    expect(await screen.findByText(/Reference: 00-other/)).toBeVisible();
    expect(screen.queryByText("You can't do this. Try something else.")).toBeNull();
  });

  it('shows pendingLabel on the confirm button while the action runs, and the confirm label again after it', async () => {
    const user = userEvent.setup();
    const action = deferred();
    render(<DeleteOrder onConfirm={() => action.promise} pendingLabel="Deleting" />);
    await user.type(confirmField(), ORDER);

    await user.click(deleteButton());

    expect(screen.getByRole('button', { name: 'Deleting' })).toHaveAttribute('aria-busy', 'true');
    await act(async () => {
      action.resolve({ ok: false, error: serverError() });
      await action.promise;
    });
    expect(deleteButton()).toBeEnabled();
  });

  it('shows a title that already ends a sentence as it is, and a title alone when there is no body', async () => {
    const user = userEvent.setup();
    const badRequest = new HttpError({
      kind: 'http',
      status: 400,
      problem: { ...problem('00-bad'), status: 400, errors: { Reason: ['Too long.'] } },
    });
    render(<DeleteOrder onConfirm={() => Promise.reject(badRequest)} />);
    await user.type(confirmField(), ORDER);

    await user.click(deleteButton());

    const error = await screen.findByText('Check the highlighted fields.');
    expect(error.textContent).toBe('Check the highlighted fields.');
  });

  it('clears the error when the next attempt starts', async () => {
    const user = userEvent.setup();
    const second = deferred();
    const onConfirm = vi
      .fn()
      .mockImplementationOnce(() => Promise.reject(serverError()))
      .mockImplementationOnce(() => second.promise);
    render(<DeleteOrder onConfirm={onConfirm} />);
    await user.type(confirmField(), ORDER);
    await user.click(deleteButton());
    await screen.findByText(/Reference:/);

    await user.click(deleteButton());

    expect(screen.queryByText(/Reference:/)).toBeNull();
    await act(async () => {
      second.resolve(undefined);
      await second.promise;
    });
  });

  it('shows no error for a failure with nothing to show (a cancelled request), and re-enables Delete', async () => {
    const user = userEvent.setup();
    render(<DeleteOrder onConfirm={() => Promise.reject(new HttpError({ kind: 'aborted' }))} />);
    await user.type(confirmField(), ORDER);

    await user.click(deleteButton());

    await vi.waitFor(() => {
      expect(deleteButton().getAttribute('aria-busy')).toBeNull();
    });
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('shows the busy button and ignores Esc while the App. D.3 loading prop is set', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<DeleteOrder confirmText={undefined} loading onCancel={onCancel} onConfirm={onConfirm} />);

    await user.keyboard('{Escape}');
    fireEvent.click(deleteButton());

    expect(deleteButton().getAttribute('aria-busy')).toBe('true');
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('renders inline in an Overlay region', () => {
    const { container } = render(
      <Overlay>
        <DeleteOrder inline />
      </Overlay>,
    );

    expect(container.querySelector('[data-ui="s-overlay"] [role="dialog"]')).not.toBeNull();
  });

  it('has no axe violations at rest and in the failure state', async () => {
    const user = userEvent.setup();
    const { container } = render(<DeleteOrder onCancel={vi.fn()} onConfirm={() => Promise.reject(serverError())} />);
    await expectNoAxeViolations(container);

    await user.type(confirmField(), ORDER);
    await user.click(deleteButton());
    await screen.findByText(/Reference:/);

    await expectNoAxeViolations(container);
  });

  it('re-renders from the React Compiler memo cache with the same output, and updates on new props', () => {
    const onCancel = vi.fn();
    const { rerender } = render(<DeleteOrder onCancel={onCancel} />);
    rerender(<DeleteOrder onCancel={onCancel} />);
    expect(screen.getByRole('dialog', { name: `Delete order ${ORDER}?` })).toBeVisible();

    rerender(<DeleteOrder onCancel={onCancel} title="Delete this payment?" confirmLabel="Delete Payment" />);
    expect(screen.getByRole('dialog', { name: 'Delete this payment?' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Delete Payment' })).toBeVisible();
  });
});

describe('ConfirmDialog scenarios (the overlays parity group)', () => {
  const byId = new Map(overlayScenarios.map((scenario) => [scenario.id, scenario]));

  it('declares the delete-order dialog empty and typed, compared in an Overlay region', () => {
    for (const id of ['confirm-delete-order', 'confirm-delete-order-typed']) {
      const scenario = byId.get(id);
      expect(scenario?.parity, id).toBe(true);
      expect(scenario?.frame, id).toBe('viewport');
      expect(scenario?.themes, id).toEqual(['light', 'dark']);
      expect(scenario?.passes, id).toEqual(['motion']);
      const text = JSON.stringify(scenario?.node);
      expect(text, id).toContain('"component":"Overlay"');
      expect(text, id).toContain('"component":"ConfirmDialog"');
      expect(text, id).toContain(`"confirmText":"${ORDER}"`);
      expect(text, id).toContain('"items":5,"payments":2,"discounts":1,"expenses":3,"images":4');
    }
    expect(byId.get('confirm-delete-order')?.node.props?.typed).toBeUndefined();
    expect(byId.get('confirm-delete-order-typed')?.node.props?.typed).toBe(ORDER);
  });

  it('declares the failure state as an implementation-only case (axe and CSP only)', () => {
    const scenario = byId.get('confirm-delete-order-error');

    expect(scenario?.parity).toBe(false);
    expect(scenario?.frame).toBe('viewport');
    expect(JSON.stringify(scenario?.node)).toContain('"component":"FailedConfirmDialog"');
  });
});

// D-39: the dialog may stay mounted with `open` false so its close animation can play; each new open starts clean.
describe('ConfirmDialog open prop (D-39)', () => {
  it('renders nothing while open is false', () => {
    const { container } = render(<DeleteOrder open={false} onCancel={vi.fn()} />);

    expect(container.childElementCount).toBe(0);
  });

  it('is open when open is omitted', () => {
    render(<DeleteOrder onCancel={vi.fn()} />);

    expect(screen.getByRole('dialog')).toBeVisible();
  });

  it('opens again with an empty type-to-confirm field', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DeleteOrder onCancel={vi.fn()} />);
    await user.type(confirmField(), ORDER);
    expect(deleteButton()).toBeEnabled();

    rerender(<DeleteOrder open={false} onCancel={vi.fn()} />);
    rerender(<DeleteOrder onCancel={vi.fn()} />);

    expect(confirmField()).toHaveValue('');
    expect(deleteButton()).toBeDisabled();
  });

  it('opens again without the failure line and with an enabled Delete', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn(() => Promise.reject(serverError()));
    const { rerender } = render(<ConfirmDialog confirmLabel="Delete Order" onConfirm={onConfirm} onCancel={vi.fn()} />);
    await user.click(deleteButton());
    await screen.findByText(/Reference:/);

    rerender(<ConfirmDialog open={false} confirmLabel="Delete Order" onConfirm={onConfirm} onCancel={vi.fn()} />);
    rerender(<ConfirmDialog confirmLabel="Delete Order" onConfirm={onConfirm} onCancel={vi.fn()} />);

    expect(screen.queryByText(/Reference:/)).toBeNull();
    expect(deleteButton()).toBeEnabled();
  });

  it('opens again without the pending state', async () => {
    const user = userEvent.setup();
    const action = deferred();
    const onConfirm = vi.fn(() => action.promise);
    const { rerender } = render(<ConfirmDialog confirmLabel="Delete Order" onConfirm={onConfirm} onCancel={vi.fn()} />);
    await user.click(deleteButton());
    expect(deleteButton().getAttribute('aria-busy')).toBe('true');

    rerender(<ConfirmDialog open={false} confirmLabel="Delete Order" onConfirm={onConfirm} onCancel={vi.fn()} />);
    rerender(<ConfirmDialog confirmLabel="Delete Order" onConfirm={onConfirm} onCancel={vi.fn()} />);

    expect(deleteButton().getAttribute('aria-busy')).toBeNull();
    await act(async () => {
      action.resolve({ ok: true, value: undefined });
      await action.promise;
    });
  });
});
