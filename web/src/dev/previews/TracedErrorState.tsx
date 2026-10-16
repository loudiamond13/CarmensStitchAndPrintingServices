// Dev-only scenario wrapper (plan 02-28; never shipped, D-20): the ErrorState banner for a failed list load whose
// HttpError carries a traceId, so the second line ends with "Reference: {traceId}". Scenario props must be plain data,
// and an HttpError is a class instance, so this wrapper builds the 500 from the plain `traceId` prop. The server title
// and detail are deliberately leaky text the banner must never show (T-02-62).
// SPEC-GAP primitives have no reference, so there is no reference fragment: that side shows its missing-component note.
import { HttpError } from '@/core/api/errors';
import { ErrorState } from '@/components/states';

export interface TracedErrorStateProps {
  /** The plural noun of the list, like "orders". */
  things: string;
  traceId: string;
  onRetry?: () => void;
}

export function TracedErrorState({ things, traceId, onRetry }: TracedErrorStateProps) {
  const error = new HttpError({
    kind: 'http',
    status: 500,
    problem: {
      type: undefined,
      title: 'Server says: SELECT * FROM Orders failed',
      status: 500,
      detail: 'at Csps.Server.Orders.Handler line 42',
      instance: undefined,
      traceId,
      code: undefined,
      errors: {},
    },
  });
  return <ErrorState things={things} error={error} onRetry={onRetry} />;
}
