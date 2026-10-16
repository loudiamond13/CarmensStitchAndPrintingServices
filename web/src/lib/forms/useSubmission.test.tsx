// WEB-09 / T-02-43: one Idempotency-Key per submission, reused only when that same submission is retried, and at most
// one request in flight per form. The harness is a real form, driven by user-event on real timers (L-24).
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '@/core/api/errors';
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

/** An upload button whose submissions are told apart by the file's name, size and date (LIB-CR-02). */
function UploadButton({ send, file }: { readonly send: Send<{ readonly file: File }>; readonly file: File }) {
  const { submit } = useSubmission(send, {
    identity: ({ file: picked }) => `${picked.name}|${String(picked.size)}|${String(picked.lastModified)}`,
  });
  return (
    <button
      type="button"
      onClick={() => {
        void submit({ file });
      }}
    >
      Upload
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
      code: undefined,
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

  it('sends nothing for a second Save with the same data after a fast success, and repeats its outcome (LIB-CR-01)', async () => {
    // A double-click whose second click lands after a fast response: the second click must not create a second record.
    const user = userEvent.setup();
    const spy = recordingSend(['ok', 'ok']);
    const onSuccess = vi.fn();
    const outcomes: SubmissionOutcome<string>[] = [];
    const onOutcome = (outcome: SubmissionOutcome<string>) => {
      outcomes.push(outcome);
    };
    render(<PaymentForm send={spy.send} data={payment} options={{ onSuccess }} onOutcome={onOutcome} />);

    await user.click(save());
    await settled();
    await user.click(save());
    await settled();
    await vi.waitFor(() => {
      expect(outcomes).toHaveLength(2);
    });

    expect(spy.send).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(outcomes[0]).toEqual({ ok: true, value: 'saved' });
    expect(outcomes[1]).toBe(outcomes[0]);
  });

  it('starts a new submission with a new key after a success once the data changes or reset() runs', async () => {
    const user = userEvent.setup();
    const spy = recordingSend(['ok', 'ok', 'ok']);
    const { rerender } = render(<PaymentForm send={spy.send} data={payment} />);

    await user.click(save());
    await settled();
    rerender(<PaymentForm send={spy.send} data={{ ...payment, amount: '1600.00' }} />);
    await user.click(save());
    await settled();
    await user.click(screen.getByRole('button', { name: 'Start Over' }));
    await user.click(save());
    await settled();

    const keys = spy.keys();
    expect(keys).toHaveLength(3);
    expect(new Set(keys).size).toBe(3);
    expect(spy.send.mock.calls[2]?.[1]).toEqual({ ...payment, amount: '1600.00' });
  });

  it.each<[string, Error]>([
    ['a network error', new HttpError({ kind: 'network' })],
    ['a timeout', new HttpError({ kind: 'timeout' })],
    ['a cancelled request', new HttpError({ kind: 'aborted' })],
    ['an unreadable 2xx reply', new HttpError({ kind: 'parse', status: 201 })],
    ['a 500', validationError(500, {})],
    ['a 503', validationError(503, {})],
    ['a 408', validationError(408, {})],
    ['a 409 (still running, SEC-06)', validationError(409, {})],
    ['an error that is not an HttpError', new Error('Server unavailable')],
  ])('reuses the key after %s, because the server may have saved it (LIB-WR-01)', async (_case, failure) => {
    const user = userEvent.setup();
    const spy = recordingSend([failure, 'ok']);
    render(<PaymentForm send={spy.send} data={payment} />);

    await user.click(save());
    await settled();
    await user.click(save());
    await settled();

    const [failed, retried] = spy.keys();
    expect(retried).toBe(failed);
  });

  it.each<[string, Error]>([
    ['a 400 with field errors', validationError(400, { Amount: ['Enter an amount.'] })],
    ['a 400 without field errors', validationError(400, {})],
    ['a 401', validationError(401, {})],
    ['a 403', validationError(403, {})],
    ['a 404', validationError(404, {})],
    ['a 422 (key reused with another body)', validationError(422, {})],
    ['a 429', validationError(429, {})],
  ])(
    'gives a new key after %s, a final answer the server would replay for 24 hours (LIB-WR-01)',
    async (_case, failure) => {
      const user = userEvent.setup();
      const spy = recordingSend([failure, 'ok']);
      render(<PaymentForm send={spy.send} data={payment} />);

      await user.click(save());
      await settled();
      await user.click(save());
      await settled();

      const [failed, retried] = spy.keys();
      expect(retried).toMatch(uuidV4);
      expect(retried).not.toBe(failed);
    },
  );

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

  const cyclic: { self?: unknown } = {};
  cyclic.self = cyclic;
  it.each<[string, unknown]>([
    ['a function', (): void => undefined],
    ['a BigInt', { amount: 1n }],
    // JSON.stringify turns each of these into "{}" (or loses its content), so two different payloads would compare
    // equal and share a key; the server would answer 422 for the changed body (LIB-CR-02).
    ['FormData', new FormData()],
    ['a File', new File(['a'], 'mockup.png', { type: 'image/png' })],
    ['a Blob', new Blob(['a'])],
    ['a Map', new Map([['amount', '1']])],
    ['a Set', new Set(['1'])],
    ['a Date', new Date(0)],
    ['an object holding a File', { file: new File(['a'], 'mockup.png') }],
    ['an array holding a Blob', [new Blob(['a'])]],
    ['a number JSON cannot hold', { amount: Number.NaN }],
    ['a symbol', { amount: Symbol('x') }],
    ['a symbol key', { [Symbol('k')]: '1' }],
    ['a cycle', cyclic],
    [
      'an object whose getter throws',
      {
        get amount(): string {
          throw new Error('unreadable');
        },
      },
    ],
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

  it('compares an upload by its identity option: same file keeps the key, another file gets a new one (LIB-CR-02)', async () => {
    const user = userEvent.setup();
    const spy = recordingSend([new Error('down'), new Error('down'), 'ok', 'ok']);
    const first = new File(['front'], 'front.png', { lastModified: 1 });
    const { rerender } = render(<UploadButton send={spy.send} file={first} />);
    const button = screen.getByRole('button', { name: 'Upload' });
    const calls = async (count: number): Promise<void> => {
      await vi.waitFor(() => {
        expect(spy.send).toHaveBeenCalledTimes(count);
      });
    };

    await user.click(button);
    await calls(1);
    // The same file picked again is a new File object, and still the same submission.
    rerender(<UploadButton send={spy.send} file={new File(['front'], 'front.png', { lastModified: 1 })} />);
    await user.click(button);
    await calls(2);
    rerender(<UploadButton send={spy.send} file={new File(['back!'], 'back.png', { lastModified: 2 })} />);
    await user.click(button);
    await calls(3);
    // After the success, the same file sends nothing more.
    await user.click(button);
    await new Promise((resolve) => setTimeout(resolve, 20));

    const keys = spy.keys();
    expect(spy.send).toHaveBeenCalledTimes(3);
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  it('compares plain JSON with null members, arrays and a null prototype, and keeps the key on a retry', async () => {
    const user = userEvent.setup();
    const spy = recordingSend([new Error('down'), 'ok']);
    const bare = Object.assign(Object.create(null) as Record<string, unknown>, { size: 'XL' });
    const data = { amount: '1500.00', note: null, tags: ['rush', 2, true], optional: undefined, bare };
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
    expect(second).toBe(first);
  });

  it('treats an identity option that throws as data it cannot compare', async () => {
    const user = userEvent.setup();
    const spy = recordingSend([new Error('down'), new Error('down')]);
    function Broken() {
      const { submit } = useSubmission(spy.send, {
        identity: () => {
          throw new Error('no identity');
        },
      });
      return (
        <button
          type="button"
          onClick={() => {
            void submit('x');
          }}
        >
          Submit
        </button>
      );
    }
    render(<Broken />);
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

  it('never repeats a success for data it cannot compare: the next submit is a new submission', async () => {
    const user = userEvent.setup();
    const spy = recordingSend(['ok', 'ok']);
    render(<SubmitButton send={spy.send} data={new FormData()} />);
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

  it('calls onFailure with the approved copy and the error, and resolves (never rejects) submit', async () => {
    const user = userEvent.setup();
    const failure = new Error('Server unavailable');
    const spy = recordingSend([failure]);
    const onSuccess = vi.fn();
    const onFailure = vi.fn();
    const onOutcome = vi.fn();
    render(<PaymentForm send={spy.send} data={payment} options={{ onSuccess, onFailure }} onOutcome={onOutcome} />);

    await user.click(save());
    await settled();

    expect(onFailure).toHaveBeenCalledExactlyOnceWith(
      { title: 'Something went wrong', body: 'Please try again.' },
      failure,
    );
    expect(onSuccess).not.toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(onOutcome).toHaveBeenCalledExactlyOnceWith({ ok: false, error: failure });
    });
  });

  it('hands onFailure the 5xx copy with the trace reference, for the danger toast (D-04)', async () => {
    const user = userEvent.setup();
    const failure = validationError(503, {});
    const onFailure = vi.fn();
    render(<PaymentForm send={recordingSend([failure]).send} data={payment} options={{ onFailure }} />);

    await user.click(save());
    await settled();

    expect(onFailure).toHaveBeenCalledExactlyOnceWith(
      { title: 'Something went wrong', body: 'Please try again. Reference: 00-4bf92f3577b34da6-01' },
      failure,
    );
  });

  it('hands onFailure the "Check the highlighted fields." banner copy for a 400 with field errors (LIB-WR-02)', async () => {
    // A server key that no rendered field matches (for example `Items[0].UnitPrice`) highlights nothing, so the
    // banner is the only feedback the user gets.
    const user = userEvent.setup();
    const failure = validationError(400, { 'Items[0].UnitPrice': ['Enter a price.'] });
    const onFailure = vi.fn();
    render(<PaymentForm send={recordingSend([failure]).send} data={payment} options={{ onFailure }} />);

    await user.click(save());
    await settled();

    expect(screen.getByRole('status', { name: 'Field errors' })).toHaveTextContent('Items[0].UnitPrice');
    expect(onFailure).toHaveBeenCalledExactlyOnceWith({ title: 'Check the highlighted fields.', body: '' }, failure);
  });

  it('does not call onFailure for a 401 after the failed refresh (sign-in takes over)', async () => {
    const user = userEvent.setup();
    const onFailure = vi.fn();
    render(
      <PaymentForm send={recordingSend([validationError(401, {})]).send} data={payment} options={{ onFailure }} />,
    );

    await user.click(save());
    await settled();

    expect(screen.getByRole('status', { name: 'Error' })).toHaveTextContent('One or more fields are invalid.');
    expect(onFailure).not.toHaveBeenCalled();
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
