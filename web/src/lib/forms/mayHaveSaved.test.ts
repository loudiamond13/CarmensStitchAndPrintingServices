import { describe, expect, it } from 'vitest';
import { HttpError } from '@/core/api/errors';
import { mayHaveSaved } from './mayHaveSaved';

function httpError(status: number): HttpError {
  return new HttpError({
    kind: 'http',
    status,
    problem: {
      type: undefined,
      title: 'x',
      status,
      detail: undefined,
      instance: undefined,
      traceId: undefined,
      code: undefined,
      errors: {},
    },
  });
}

describe('mayHaveSaved', () => {
  it.each([500, 502, 503, 408])('is true for a %i', (status) => {
    expect(mayHaveSaved(httpError(status))).toBe(true);
  });

  it.each([400, 401, 403, 404, 409, 422, 429])('is false for a %i, which saved nothing', (status) => {
    expect(mayHaveSaved(httpError(status))).toBe(false);
  });

  it('is true when there was no answer or the error is not an HTTP error', () => {
    expect(mayHaveSaved(new Error('Failed to fetch'))).toBe(true);
    expect(mayHaveSaved(undefined)).toBe(true);
  });
});
