// UI-SPEC Copywriting "HttpError -> message defaults" and "Server error, any 5xx": one shared mapper (T-02-30).
import { describe, expect, it } from 'vitest';
import { HttpError, type HttpErrorKind } from '@/lib/api';
import { describeHttpError } from './describeHttpError';

interface ProblemInit {
  readonly title?: string;
  readonly traceId?: string;
  readonly errors?: Readonly<Record<string, readonly string[]>>;
}

function httpError(status: number, init: ProblemInit = {}): HttpError {
  return new HttpError({
    kind: 'http',
    status,
    problem: {
      type: undefined,
      title: init.title,
      status,
      detail: undefined,
      instance: undefined,
      traceId: init.traceId,
      errors: init.errors ?? {},
    },
  });
}

const unreachable = { title: "Couldn't reach the server", body: 'Check your internet connection and try again.' };

describe('describeHttpError', () => {
  it.each<HttpErrorKind>(['network', 'timeout'])('says the server could not be reached for kind %s', (kind) => {
    expect(describeHttpError(new HttpError({ kind }))).toEqual(unreachable);
  });

  it('asks to check the highlighted fields for a 400 with field errors, and passes the field errors on', () => {
    const errors = { amount: ['Enter an amount greater than 0.'], method: ['Choose a payment method.'] };

    expect(describeHttpError(httpError(400, { title: 'One or more fields are invalid.', errors }))).toEqual({
      title: 'Check the highlighted fields.',
      body: '',
      fieldErrors: errors,
    });
  });

  it.each([
    [403, "You don't have access to this", 'Ask a Manager if you need it.'],
    [404, 'Not found', 'It may have been deleted. Go back and refresh the list.'],
    [409, 'Someone else changed this', 'Reload to see the latest version, then make your change again.'],
    [429, 'Too many tries', 'Wait a minute, then try again.'],
  ])('gives the approved copy for %i', (status, title, body) => {
    expect(describeHttpError(httpError(status, { title: 'Server wording', traceId: '00-abc-01' }))).toEqual({
      title,
      body,
    });
  });

  it.each([500, 503])('gives the 5xx copy with the trace reference for %i', (status) => {
    expect(describeHttpError(httpError(status, { traceId: '00-4bf92f3577b34da6-01' }))).toEqual({
      title: 'Something went wrong',
      body: 'Please try again. Reference: 00-4bf92f3577b34da6-01',
    });
  });

  it('leaves the reference out of the 5xx copy when there is no traceId', () => {
    expect(describeHttpError(httpError(502))).toEqual({ title: 'Something went wrong', body: 'Please try again.' });
  });

  it('never shows server text: a 5xx title such as a stack trace is replaced by the approved copy', () => {
    const copy = describeHttpError(httpError(500, { title: 'System.NullReferenceException at Csps.Server.Foo()' }));

    expect(JSON.stringify(copy)).not.toContain('NullReferenceException');
  });

  it.each([
    ['a 400 without field errors', httpError(400, { traceId: '00-def-01' })],
    ['an unmapped 4xx', httpError(422, { traceId: '00-def-01' })],
    ['an unreadable 2xx body', new HttpError({ kind: 'parse', status: 200 })],
  ])('falls back to the 5xx copy for %s', (_case, error) => {
    const copy = describeHttpError(error);

    expect(copy?.title).toBe('Something went wrong');
    expect(copy?.body).toMatch(/^Please try again\.( Reference: 00-def-01)?$/);
  });

  it('shows no message for a 401 (sign-in takes over) or a request the user cancelled', () => {
    expect(describeHttpError(httpError(401))).toBeNull();
    expect(describeHttpError(new HttpError({ kind: 'aborted' }))).toBeNull();
  });

  it.each([new Error('boom'), 'a string', undefined, { status: 404 }])(
    'gives the 5xx copy without a reference for a value that is not an HttpError (%s)',
    (value) => {
      expect(describeHttpError(value)).toEqual({ title: 'Something went wrong', body: 'Please try again.' });
    },
  );
});
