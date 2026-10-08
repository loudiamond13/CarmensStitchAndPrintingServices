// WEB-09 / T-02-43: one Idempotency-Key per submission, reused only when that same submission is retried, and at most
// one request in flight per form. The harness is a real form, driven by user-event on real timers (L-24).
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '@/lib/api';
import { createDeferred } from '@/test/fakeFetch';
import { useSubmission, type SubmissionOptions, type SubmissionOutcome } from './useSubmission';

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

interface Payment {
  readonly orderId: string;
  readonly amount: string;
}

const payment: Payment = { orderId: 'ORD-2026-0148', amount: '1500.00' };

type Send<TData> = (key: string, data: TData) => Promise<string>;

interface PaymentFormProps {
  readonly send: Send<Payment>;
  readonly data: Payment;
  readonly options?: SubmissionOptions<Payment, string>;
  readonly onOutcome?: (outcome: SubmissionOutcome<string>) => void;
}

function PaymentForm({ send, data, options, onOutcome }: PaymentFormProps) {
  const { submit, pending, error, fieldErrors, reset } = useSubmission(send, options);
  return (
    <form
      aria-label="Payment"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(data).then(onOutcome);
      }}
    >
      <label>
        Amount
        <input name="amount" defaultValue={data.amount} />
      </label>
      <button type="submit">Save Payment</button>
      <button type="button" onClick={reset}>
        Start Over
      </button>
      <output aria-label="Progress">{pending ? 'Saving' : 'Idle'}</output>
      <output aria-label="Error">{error instanceof Error ? error.message : ''}</output>
      <output aria-label="Field errors">{JSON.stringify(fieldErrors)}</output>
    </form>
  );
}

/** A confirm button whose submission carries no data, such as Delete Order. */
function DeleteButton({ send }: { readonly send: (key: string) => Promise<string> }) {
  const { submit, pending } = useSubmission((key: string) => send(key));
  return (
    <button
      type="button"
      onClick={() => {
        void submit();
      }}
    >
      {pending ? 'Deleting' : 'Delete Order'}
    </button>
  );
}

/** A button that submits whatever data it is given, for values JSON cannot compare. */
function SubmitButton<TData>({ send, data }: { readonly send: Send<TData>; readonly data: TData }) {
  const { submit } = useSubmission(send);
  return (
    <button
      type="button"
      onClick={() => {
        void submit(data);
      }}
    >
      Submit
    </button>
  );
}

/** A send spy answering from `outcomes` in order: 'ok' resolves, an Error rejects. Past the end it resolves. */
function recordingSend(outcomes: readonly ('ok' | Error)[]) {
  const queue = [...outcomes];
  const send = vi.fn<(key: string, data: unknown) => Promise<string>>(() => {
    const next = queue.shift() ?? 'ok';
    return next === 'ok' ? Promise.resolve('saved') : Promise.reject(next);
  });
  return { send, keys: (): string[] => send.mock.calls.map(([key]) => key) };
}

function validationError(status: number, errors: Readonly<Record<string, readonly string[]>>): HttpError {
  return new HttpError({
    kind: 'http',
    status,
    problem: {
      type: undefined,
      title: 'One or more fields are invalid.',
      status,
      detail: undefined,
      instance: undefined,
      traceId: '00-4bf92f3577b34da6-01',
      errors,
    },
  });
}

const progress = () => screen.getByRole('status', { name: 'Progress' });
const save = () => screen.getByRole('button', { name: 'Save Payment' });

async function settled(): Promise<void> {
  await vi.waitFor(() => {
    expect(progress()).toHaveTextContent('Idle');
  });
}

describe('useSubmission: one request in flight (WEB-09 concurrency)', () => {
  it('sends exactly one request for a double-clicked Save, pending until it settles', async () => {
    const user = userEvent.setup();
    const deferred = createDeferred<string>();
    const send = vi.fn<Send<Payment>>(() => deferred.promise);
    render(<PaymentForm send={send} data={payment} />);
    expect(progress()).toHaveTextContent('Idle');

    await user.dblClick(save());

    await vi.waitFor(() => {
      expect(progress()).toHaveTextContent('Saving');
    });
    expect(send).toHaveBeenCalledTimes(1);
    const [key, data] = send.mock.calls[0] ?? [];
    expect(key).toMatch(uuidV4);
    expect(data).toEqual(payment);

    await act(async () => {
      deferred.resolve('saved');
      await deferred.promise;
    });
    await settled();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('ignores a second Enter while the submission is pending', async () => {
    const user = userEvent.setup();
    const deferred = createDeferred<string>();
    const send = vi.fn<Send<Payment>>(() => deferred.promise);
    render(<PaymentForm send={send} data={payment} />);

    await user.type(screen.getByRole('textbox', { name: 'Amount' }), '{Enter}{Enter}');

    await vi.waitFor(() => {
      expect(progress()).toHaveTextContent('Saving');
    });
    expect(send).toHaveBeenCalledTimes(1);
    await act(async () => {
      deferred.resolve('saved');
      await deferred.promise;
    });
    await settled();
  });

  it('gives a trigger during the pending submission the same outcome, even with changed data', async () => {
    const user = userEvent.setup();
    const deferred = createDeferred<string>();
    const send = vi.fn<Send<Payment>>(() => deferred.promise);
    const outcomes: SubmissionOutcome<string>[] = [];
    const onOutcome = (outcome: SubmissionOutcome<string>) => {
      outcomes.push(outcome);
    };
    const { rerender } = render(<PaymentForm send={send} data={payment} onOutcome={onOutcome} />);

    await user.click(save());
    rerender(<PaymentForm send={send} data={{ ...payment, amount: '9.00' }} onOutcome={onOutcome} />);
    await user.click(save());

    expect(send).toHaveBeenCalledTimes(1);
    await act(async () => {
      deferred.resolve('saved once');
      await deferred.promise;
    });
    await settled();
    expect(outcomes).toEqual([
      { ok: true, value: 'saved once' },
      { ok: true, value: 'saved once' },
    ]);
    expect(outcomes[1]).toBe(outcomes[0]);
  });
});

describe('useSubmission: key per submission (WEB-09 idempotency)', () => {
  it('reuses the key when a failed submission is retried with the same data, until it succeeds', async () => {
    const user = userEvent.setup();
    const spy = recordingSend([new Error('Server unavailable'), new Error('Server unavailable'), 'ok']);
    const { rerender } = render(<PaymentForm send={spy.send} data={payment} />);

    await user.click(save());
    await settled();
    // An equal but new object is the same submission: data is compared by its JSON.
    rerender(<PaymentForm send={spy.send} data={{ orderId: 'ORD-2026-0148', amount: '1500.00' }} />);
    await user.click(save());
    await settled();
    await user.click(save());
    await settled();

    const keys = spy.keys();
    expect(keys).toHaveLength(3);
    expect(keys[0]).toMatch(uuidV4);
    expect(new Set(keys).size).toBe(1);
  });

  it('gives the next submission a new key after a success, even with the same data', async () => {
    const user = userEvent.setup();
    const spy = recordingSend(['ok', 'ok']);
    render(<PaymentForm send={spy.send} data={payment} />);

    await user.click(save());
    await settled();
    await user.click(save());
    await settled();

    const [first, second] = spy.keys();
    expect(second).toMatch(uuidV4);
    expect(second).not.toBe(first);
  });

  it('gives a new key when the data changed after a failure', async () => {
    const user = userEvent.setup();
    const spy = recordingSend([new Error('Server unavailable'), 'ok']);
    const { rerender } = render(<PaymentForm send={spy.send} data={payment} />);

    await user.click(save());
    await settled();
    rerender(<PaymentForm send={spy.send} data={{ ...payment, amount: '1600.00' }} />);
    await user.click(save());
    await settled();

    const [failed, changed] = spy.keys();
    expect(changed).not.toBe(failed);
    expect(spy.send.mock.calls[1]?.[1]).toEqual({ ...payment, amount: '1600.00' });
  });

  it('reuses the key when a failed submission with no data is retried (a confirm button)', async () => {
    const user = userEvent.setup();
    const keys: string[] = [];
    const send = (key: string) => {
      keys.push(key);
      return keys.length === 1 ? Promise.reject(new Error('Server unavailable')) : Promise.resolve('deleted');
    };
    render(<DeleteButton send={send} />);
    const button = screen.getByRole('button', { name: 'Delete Order' });

    await user.click(button);
    await vi.waitFor(() => {
      expect(button).toHaveTextContent('Delete Order');
    });
    await user.click(button);
    await vi.waitFor(() => {
      expect(keys).toHaveLength(2);
    });

    expect(keys[0]).toMatch(uuidV4);
    expect(keys[1]).toBe(keys[0]);
  });

  it.each([
    ['a function', (): void => undefined],
    ['a BigInt', { amount: 1n }],
  ])('never reuses a key for data JSON cannot compare (%s)', async (_case, data) => {
    const user = userEvent.setup();
    const spy = recordingSend([new Error('down'), new Error('down')]);
    render(<SubmitButton send={spy.send} data={data} />);
    const button = screen.getByRole('button', { name: 'Submit' });

    await user.click(button);
    await vi.waitFor(() => {
      expect(spy.send).toHaveBeenCalledTimes(1);
    });
    await user.click(button);
    await vi.waitFor(() => {
      expect(spy.send).toHaveBeenCalledTimes(2);
    });

    const [first, second] = spy.keys();
    expect(second).not.toBe(first);
  });

  it('forgets the failure, its error and its key on reset()', async () => {
    const user = userEvent.setup();
    const spy = recordingSend([new Error('Server unavailable'), 'ok']);
    render(<PaymentForm send={spy.send} data={payment} />);

    await user.click(save());
    await settled();
    expect(screen.getByRole('status', { name: 'Error' })).toHaveTextContent('Server unavailable');
    await user.click(screen.getByRole('button', { name: 'Start Over' }));
    expect(screen.getByRole('status', { name: 'Error' })).toHaveTextContent('');
    await user.click(save());
    await settled();

    const [failed, afterReset] = spy.keys();
    expect(afterReset).not.toBe(failed);
  });
});

describe('useSubmission: results and errors', () => {
  it('exposes the server field messages from a 400, and clears them after a success', async () => {
    const user = userEvent.setup();
    const errors = { Amount: ['Enter an amount greater than 0.'] };
    const spy = recordingSend([validationError(400, errors), 'ok']);
    render(<PaymentForm send={spy.send} data={payment} />);
    const fieldErrors = screen.getByRole('status', { name: 'Field errors' });

    await user.click(save());
    await settled();
    expect(fieldErrors).toHaveTextContent(JSON.stringify(errors));
    expect(screen.getByRole('status', { name: 'Error' })).toHaveTextContent('One or more fields are invalid.');

    await user.click(save());
    await settled();
    expect(fieldErrors).toHaveTextContent('{}');
    expect(screen.getByRole('status', { name: 'Error' })).toHaveTextContent('');
  });

  it.each([
    ['a 400 without field errors', validationError(400, {})],
    ['a 500 that carries an errors member', validationError(500, { Amount: ['x'] })],
    ['an error that is not an HttpError', new Error('Server unavailable')],
  ])('has no field errors for %s', async (_case, failure) => {
    const user = userEvent.setup();
    const spy = recordingSend([failure]);
    render(<PaymentForm send={spy.send} data={payment} />);

    await user.click(save());
    await settled();

    expect(spy.send).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status', { name: 'Field errors' })).toHaveTextContent('{}');
  });

  it('calls onSuccess with the result and the data, and resolves submit with the outcome', async () => {
    const user = userEvent.setup();
    const spy = recordingSend(['ok']);
    const onSuccess = vi.fn();
    const onFailure = vi.fn();
    const onOutcome = vi.fn();
    render(<PaymentForm send={spy.send} data={payment} options={{ onSuccess, onFailure }} onOutcome={onOutcome} />);

    await user.click(save());
    await settled();

    expect(onSuccess).toHaveBeenCalledExactlyOnceWith('saved', payment);
    expect(onFailure).not.toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(onOutcome).toHaveBeenCalledExactlyOnceWith({ ok: true, value: 'saved' });
    });
  });

  it('calls onFailure with the error, and resolves (never rejects) submit with the failure', async () => {
    const user = userEvent.setup();
    const failure = new Error('Server unavailable');
    const spy = recordingSend([failure]);
    const onSuccess = vi.fn();
    const onFailure = vi.fn();
    const onOutcome = vi.fn();
    render(<PaymentForm send={spy.send} data={payment} options={{ onSuccess, onFailure }} onOutcome={onOutcome} />);

    await user.click(save());
    await settled();

    expect(onFailure).toHaveBeenCalledExactlyOnceWith(failure);
    expect(onSuccess).not.toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(onOutcome).toHaveBeenCalledExactlyOnceWith({ ok: false, error: failure });
    });
  });

  it('treats a send that throws before returning a promise as a failed submission, and can submit again', async () => {
    const user = userEvent.setup();
    const send = vi
      .fn<Send<Payment>>(() => Promise.resolve('saved'))
      .mockImplementationOnce(() => {
        throw new Error('Bad request shape');
      });
    render(<PaymentForm send={send} data={payment} />);

    await user.click(save());
    await settled();
    expect(screen.getByRole('status', { name: 'Error' })).toHaveTextContent('Bad request shape');

    await user.click(save());
    await settled();
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1]?.[0]).toBe(send.mock.calls[0]?.[0]);
    expect(screen.getByRole('status', { name: 'Error' })).toHaveTextContent('');
  });

  it('keeps working across re-renders with the same props and with new props', async () => {
    const user = userEvent.setup();
    const spy = recordingSend(['ok', 'ok']);
    const { rerender } = render(<PaymentForm send={spy.send} data={payment} />);

    rerender(<PaymentForm send={spy.send} data={payment} />);
    await user.click(save());
    await settled();
    const other = recordingSend(['ok']);
    rerender(<PaymentForm send={other.send} data={{ ...payment, amount: '20.00' }} />);
    await user.click(save());
    await settled();

    expect(spy.send).toHaveBeenCalledTimes(1);
    expect(other.send).toHaveBeenCalledExactlyOnceWith(expect.stringMatching(uuidV4), { ...payment, amount: '20.00' });
  });
});
