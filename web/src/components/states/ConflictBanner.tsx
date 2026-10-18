// SPEC-GAP: ConflictBanner (UI-SPEC "ConflictBanner" and Interaction Contract "Stale save (409)"; D-20, SEC-07; plan 05-13).
// The shared stale-save banner of every aggregate form: the `.s-banner.is-danger` look of ErrorState with the icon and
// text at the top, a bold line, a muted line and a secondary sm "Load Latest" button. It is an alert, so it is announced
// when it appears, and it puts focus on Load Latest because that is the one thing to do next. It never clears anything
// itself: the form keeps every typed value until Load Latest has fetched the latest version and the form replaces them.
import { useEffect, useRef } from 'react';
import { Button } from '@/components/actions';
import { Icon } from '@/components/brand';
import { STATES_COPY } from './copy';
import { bannerStartClasses, bannerTextClasses } from './states.recipe';

export interface ConflictBannerProps {
  /** Fetches the latest version; the form decides what to do with it. */
  onLoadLatest: () => void;
  /** The latest version is on its way: the button reads "Loading" and ignores presses. */
  pending?: boolean | undefined;
}

export function ConflictBanner({ onLoadLatest, pending = false }: ConflictBannerProps) {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    button.current?.focus();
  }, []);
  return (
    <div className={bannerStartClasses} role="alert">
      <Icon name="triangle-alert" size={20} />
      <div className={bannerTextClasses}>
        <strong>{STATES_COPY.conflict.title}</strong>
        <span>{STATES_COPY.conflict.body}</span>
      </div>
      <Button ref={button} variant="secondary" size="sm" pending={pending} onClick={onLoadLatest}>
        {pending ? STATES_COPY.conflict.loading : STATES_COPY.conflict.loadLatest}
      </Button>
    </div>
  );
}
