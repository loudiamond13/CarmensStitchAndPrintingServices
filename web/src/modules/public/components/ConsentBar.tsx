// CB1: the cookie bar (ANL-01, ANL-07, D-16, D-17). A section named "Cookie choices", fixed to the bottom of the page.
// The bar takes no focus on load and is not a live region. Accept All and Reject All are the same variant and class
// string. A choice closes the bar at once and moves focus to main without scrolling; ConsentSlot announces it.
// SPEC-GAP: CB1 has no spec markup beyond the UI-SPEC paragraph; the DOM order is Cookie Settings, Reject All, Accept All.
import { Button } from '@/components/actions/Button';
import { UiLink } from '@/components/actions/UiLink';
import { CONSENT_COPY } from '../consentCopy';
import { focusMain } from '../consentFocus';
import { useConsent } from '../hooks/useConsent';
import {
  barClasses,
  buttonsClasses,
  choiceClasses,
  innerClasses,
  policyLinkClasses,
  settingsClasses,
  textClasses,
} from './consent.recipe';

// The save path starts loading with the bar, so a click applies the choice at once (it is not in the first download).
void import('../consentSave');

export function ConsentBar() {
  const { acceptAll, rejectAll, openSettings } = useConsent();
  return (
    <section aria-label={CONSENT_COPY.barLabel} data-consent-bar className={barClasses}>
      <div className={innerClasses}>
        <p className={textClasses}>
          {CONSENT_COPY.barText}{' '}
          <UiLink to="/cookies" className={policyLinkClasses}>
            {CONSENT_COPY.policyLink}
          </UiLink>
          {CONSENT_COPY.barTextEnd}
        </p>
        <div className={buttonsClasses}>
          <Button
            variant="ghost"
            className={settingsClasses}
            onClick={(event) => {
              openSettings(event.currentTarget);
            }}
          >
            {CONSENT_COPY.settings}
          </Button>
          <Button
            variant="secondary"
            className={choiceClasses}
            onClick={() => {
              void rejectAll('bar');
              focusMain();
            }}
          >
            {CONSENT_COPY.reject}
          </Button>
          <Button
            variant="secondary"
            className={choiceClasses}
            onClick={() => {
              void acceptAll('bar');
              focusMain();
            }}
          >
            {CONSENT_COPY.accept}
          </Button>
        </div>
      </div>
    </section>
  );
}
