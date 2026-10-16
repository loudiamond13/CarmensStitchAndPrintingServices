// Shared by the dev-only auth previews (plan 04-32; never shipped, D-20): a 500 answer that carries a reference, the
// failure a banner or a dialog shows with "Reference: {traceId}".
import { HttpError } from '@/core/api/errors';

export function serverError(traceId: string): HttpError {
  return new HttpError({
    kind: 'http',
    status: 500,
    problem: {
      type: undefined,
      title: 'Internal Server Error',
      status: 500,
      detail: undefined,
      instance: undefined,
      traceId,
      code: undefined,
      errors: {},
    },
  });
}
