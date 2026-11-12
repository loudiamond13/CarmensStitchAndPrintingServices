// The open status pill and line of the Contact hours card (PUB-05, D-22; UI-SPEC C1 OpenStatus). Everything shown comes
// from the server's answer; nothing here reads the clock or the time zone.
// Loading: a pill-sized skeleton and a line-sized one (so the card does not jump). Failure: neither is rendered.
import { Skeleton } from '@/components/feedback/Skeleton';
import { HOURS_COPY, statusLine } from '../hoursCopy';
import { useOpenStatusQuery } from '../hooks/useOpenStatusQuery';
import { closedPillClasses, openPillClasses, statusLineClasses } from './hours.recipe';

const { open: OPEN, closed: CLOSED } = HOURS_COPY;

export function OpenStatus() {
  const state = useOpenStatusQuery();
  if (state.status === 'error') {
    return null;
  }
  if (state.status === 'loading') {
    return (
      <>
        <Skeleton width={84} height={16} radius={8} />
        <Skeleton className="basis-full" width="60%" height={20} />
      </>
    );
  }
  const line = statusLine(state.data);
  return (
    <>
      <span className={state.data.isOpen ? openPillClasses : closedPillClasses}>
        {state.data.isOpen ? OPEN : CLOSED}
      </span>
      {line !== null && <p className={statusLineClasses}>{line}</p>}
    </>
  );
}
