// UI-SPEC Copywriting Contract: "HttpError → message defaults" and "Server error, any 5xx", from one shared mapper.
// Server text never reaches the screen; the only server value shown is the traceId reference (T-02-44, CWE-209).
import { describe, expect, it } from 'vitest';
import { HttpError, type HttpErrorKind } from '@/core/api/errors';
import { describeHttpError, errorLine } from './describeHttpError';

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
      code: undefined,
      errors: init.errors ?? {},
    },
  });
}

const traceId = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

describe('describeHttpError', () => {
  it.each<HttpErrorKind>(['network', 'timeout'])('says the server could not be reached for a %s failure', (kind) => {
    expect(describeHttpError(new HttpError({ kind }))).toEqual({
      title: "Couldn't reach the server",
      body: 'Check your internet connection and try again.',
    });
  });

  it('asks to check the highlighted fields for a 400 with field errors (the messages go under the fields)', () => {
    const errors = { Amount: ['Enter an amount greater than 0.'] };

    expect(describeHttpError(httpError(400, { title: 'One or more fields are invalid.', errors, traceId }))).toEqual({
      title: 'Check the highlighted fields.',
      body: '',
    });
  });

  it.each([
    [403, "You don't have access to this", 'Ask a Manager if you need it.'],
    [404, 'Not found', 'It may have been deleted. Go back and refresh the list.'],
    [409, 'Someone else changed this', 'Reload to see the latest version, then make your change again.'],
    [429, 'Too many tries', 'Wait a minute, then try again.'],
  ])('gives the approved copy for a %i', (status, title, body) => {
    expect(describeHttpError(httpError(status, { title: 'Server wording' }))).toEqual({ title, body });
  });

  it.each([
    [403, 'Ask a Manager if you need it.'],
    [409, 'Reload to see the latest version, then make your change again.'],
  ])('ends the second line of a %i with the trace reference when the server sent one', (status, body) => {
    expect(describeHttpError(httpError(status, { traceId }))?.body).toBe(`${body} Reference: ${traceId}`);
  });

  it.each([500, 502, 503, 504])('gives the 5xx copy with the trace reference for a %i', (status) => {
    expect(describeHttpError(httpError(status, { traceId }))).toEqual({
      title: 'Something went wrong',
      body: `Please try again. Reference: ${traceId}`,
    });
  });

  it('leaves the reference out of the 5xx copy when there is no traceId', () => {
    expect(describeHttpError(httpError(503))).toEqual({ title: 'Something went wrong', body: 'Please try again.' });
  });

  it('never shows server text: a 5xx title such as a stack trace is replaced by the approved copy', () => {
    const copy = describeHttpError(httpError(500, { title: 'System.NullReferenceException at Csps.Server.Foo()' }));

    expect(JSON.stringify(copy)).not.toContain('NullReferenceException');
  });

  it.each([
    ['a 400 without field errors', httpError(400, { traceId })],
    ['an unmapped 4xx', httpError(422, { traceId })],
    ['an unreadable 2xx body', new HttpError({ kind: 'parse', status: 200 })],
  ])('falls back to the 5xx copy for %s', (_case, error) => {
    const copy = describeHttpError(error);

    expect(copy?.title).toBe('Something went wrong');
    expect(copy?.body).toMatch(/^Please try again\.( Reference: 00-[0-9a-f-]+)?$/);
  });

  it('shows nothing for a 401 after the failed refresh (sign-in takes over in Phase 4)', () => {
    expect(describeHttpError(httpError(401, { traceId }))).toBeNull();
  });

  it('shows nothing for a request the user cancelled', () => {
    expect(describeHttpError(new HttpError({ kind: 'aborted' }))).toBeNull();
  });

  it.each([new Error('boom'), 'a string', undefined, { status: 404, traceId }])(
    'gives the 5xx copy without a reference for a value that is not an HttpError (%s)',
    (value) => {
      expect(describeHttpError(value)).toEqual({ title: 'Something went wrong', body: 'Please try again.' });
    },
  );
});

describe('errorLine', () => {
  it('makes the title a sentence and adds the body', () => {
    expect(errorLine({ title: 'Something went wrong', body: 'Please try again.' })).toBe(
      'Something went wrong. Please try again.',
    );
  });

  it('keeps a title that already ends a sentence', () => {
    expect(errorLine({ title: 'Check the highlighted fields.', body: '' })).toBe('Check the highlighted fields.');
    expect(errorLine({ title: 'Really?', body: 'Yes.' })).toBe('Really? Yes.');
  });
});
