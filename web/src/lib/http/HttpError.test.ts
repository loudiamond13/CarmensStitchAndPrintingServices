import { describe, expect, it } from 'vitest';
import { HttpError, isHttpError, parseProblemDetails, type HttpErrorKind } from './HttpError';

const problem = (overrides: Partial<Record<string, unknown>> = {}) =>
  parseProblemDetails({ title: 'Not found', status: 404, traceId: 'abc', ...overrides });

describe('HttpError', () => {
  it('is an Error named HttpError that carries kind, status, problem, field errors and traceId', () => {
    const parsed = parseProblemDetails({
      title: 'Check the fields',
      status: 400,
      traceId: 't-1',
      errors: { Amount: ['Enter an amount.'] },
    });
    const error = new HttpError({ kind: 'http', status: 400, problem: parsed });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('HttpError');
    expect(error.kind).toBe('http');
    expect(error.status).toBe(400);
    expect(error.problem).toBe(parsed);
    expect(error.fieldErrors).toEqual({ Amount: ['Enter an amount.'] });
    expect(error.traceId).toBe('t-1');
  });

  it('defaults to status 0, no problem, no field errors and no traceId when there was no HTTP response', () => {
    const error = new HttpError({ kind: 'network' });

    expect(error.status).toBe(0);
    expect(error.problem).toBeUndefined();
    expect(error.fieldErrors).toEqual({});
    expect(error.traceId).toBeUndefined();
  });

  it('uses the problem title as its message', () => {
    expect(new HttpError({ kind: 'http', status: 404, problem: problem() }).message).toBe('Not found');
  });

  it.each<[HttpErrorKind, string]>([
    ['network', "We couldn't reach the server. Check your connection and try again."],
    ['timeout', 'The server took too long to answer. Please try again.'],
    ['aborted', 'The request was cancelled.'],
    ['http', "The server couldn't complete the request."],
    ['parse', "The server sent a reply we couldn't read."],
  ])('gives kind %s a plain-English default message', (kind, message) => {
    expect(new HttpError({ kind }).message).toBe(message);
  });

  it('falls back to the default message when the title is blank', () => {
    const error = new HttpError({ kind: 'http', status: 500, problem: problem({ title: '   ' }) });

    expect(error.message).toBe("The server couldn't complete the request.");
  });

  it('never puts response text or a stack in its message', () => {
    const cause = new Error('System.NullReferenceException at Csps.Server.Foo()');
    const error = new HttpError({ kind: 'http', status: 500, cause });

    expect(error.message).not.toContain('Exception');
    expect(error.message).not.toContain(' at ');
    expect(error.cause).toBe(cause);
  });
});

describe('isHttpError', () => {
  it('is true only for HttpError instances', () => {
    expect(isHttpError(new HttpError({ kind: 'timeout' }))).toBe(true);
    expect(isHttpError(new Error('x'))).toBe(false);
    expect(isHttpError(new TypeError('x'))).toBe(false);
    expect(isHttpError({ kind: 'http', status: 404 })).toBe(false);
    expect(isHttpError(null)).toBe(false);
    expect(isHttpError(undefined)).toBe(false);
  });
});

describe('parseProblemDetails', () => {
  it('reads the RFC 9457 members and the traceId extension', () => {
    expect(
      parseProblemDetails({
        type: 'https://tools.ietf.org/html/rfc9110#section-15.5.5',
        title: 'Not found',
        status: 404,
        detail: 'No such order.',
        instance: '/api/v1/orders/9',
        traceId: '00-abc-01',
      }),
    ).toEqual({
      type: 'https://tools.ietf.org/html/rfc9110#section-15.5.5',
      title: 'Not found',
      status: 404,
      detail: 'No such order.',
      instance: '/api/v1/orders/9',
      traceId: '00-abc-01',
      errors: {},
    });
  });

  it('drops members with the wrong type', () => {
    expect(
      parseProblemDetails({ type: 1, title: false, status: '404', detail: {}, instance: [], traceId: 7 }),
    ).toEqual({
      type: undefined,
      title: undefined,
      status: undefined,
      detail: undefined,
      instance: undefined,
      traceId: undefined,
      errors: {},
    });
  });

  it('keeps only string messages in each field-error list', () => {
    const parsed = parseProblemDetails({
      errors: { Amount: ['Enter an amount.', 5, null], Name: 'not a list', Qty: ['Enter a quantity.'] },
    });

    expect(parsed?.errors).toEqual({ Amount: ['Enter an amount.'], Qty: ['Enter a quantity.'] });
  });

  it.each([['a string'], [null], [['not', 'an', 'object']], [42]])('ignores errors that are not an object (%j)', (errors) => {
    expect(parseProblemDetails({ errors })?.errors).toEqual({});
  });

  it.each([[null], [undefined], ['text'], [404], [['a']]])('returns undefined for a body that is not an object (%j)', (body) => {
    expect(parseProblemDetails(body)).toBeUndefined();
  });
});
