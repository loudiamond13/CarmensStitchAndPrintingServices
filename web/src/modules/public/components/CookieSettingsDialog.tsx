// CS1: the Cookie Settings window (ANL-01, ANL-03, ANL-07, D-17, D-20, D-34, D-36). Its own lazy chunk: ConsentSlot loads
// it while the window is open, so no public page's first download carries it (PERF-01).
// SPEC-GAP: CS1 has no spec markup beyond the UI-SPEC section; it is a Modal (a bottom sheet at 639px and below) with the
// choices in a fieldset and the buttons in the footer.
//   - The boxes start from the saved choice, and unticked when none is saved or while the bar still asks (D-34). What the
//     visitor ticks is kept apart from that, so a later change to the saved choice never undoes a tick.
//   - Under GPC (D-20) Visitor stats is locked off with its own hint, the Google map box works, and only Save Choices shows.
//   - A choice closes the window first and is then saved, so the "saved" line is read while the page is live again. When
//     the bar was showing, focus goes to `main` once the bar has closed; otherwise it goes back to the opener.
import { useEffect, useState } from 'react';
import { Button } from '@/components/actions/Button';
import { UiLink } from '@/components/actions/UiLink';
import { Checkbox } from '@/components/entry/Checkbox';
import { Modal } from '@/components/overlays/Modal';
import { Note } from '@/components/states/Note';
import { Badge } from '@/components/status/Badge';
import { formatCalendarDate } from '@/utils/format';
import { CONSENT_COPY } from '../consentCopy';
import { focusMainWhenChosen } from '../consentFocus';
import { useConsent } from '../hooks/useConsent';
import {
  descriptionClasses,
  fieldsetClasses,
  legendClasses,
  necessaryHeadClasses,
  smallMutedClasses,
  windowLinkClasses,
} from './consent.recipe';

// The save path starts loading with the window, so a click applies the choice at once (it is not in the first download).
void import('../consentSave');

const { window: WINDOW } = CONSENT_COPY;

interface Boxes {
  stats: boolean;
  map: boolean;
}

export function CookieSettingsDialog() {
  const consent = useConsent();
  const { cookie, current, gpc, needsChoice, statsAllowed, mapAllowed } = consent;
  const { save, acceptAll, rejectAll, closeSettings, settingsReady } = consent;
  const [edits, setEdits] = useState<Partial<Boxes>>({});
  const boxes: Boxes = {
    stats: edits.stats ?? (!needsChoice && statsAllowed),
    map: edits.map ?? (!needsChoice && mapAllowed),
  };
  const savedDate = cookie !== null && current && !needsChoice ? formatCalendarDate(cookie.decidedOn) : null;

  useEffect(() => {
    settingsReady();
  }, [settingsReady]);

  const choose = (run: () => Promise<void>) => {
    const barWasOpen = needsChoice;
    closeSettings();
    void run();
    if (barWasOpen) focusMainWhenChosen();
  };

  return (
    <Modal
      title={WINDOW.title}
      onClose={closeSettings}
      footer={
        <>
          {!gpc && (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  choose(() => rejectAll('settings'));
                }}
              >
                {CONSENT_COPY.reject}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  choose(() => acceptAll('settings'));
                }}
              >
                {CONSENT_COPY.accept}
              </Button>
            </>
          )}
          <Button
            variant="primary"
            onClick={() => {
              choose(() => save(boxes, 'settings'));
            }}
          >
            {WINDOW.save}
          </Button>
        </>
      }
    >
      <div>
        <p className={descriptionClasses}>{WINDOW.description}</p>
        <UiLink to="/cookies" className={windowLinkClasses} onClick={closeSettings}>
          {WINDOW.policyLink}
        </UiLink>
      </div>
      {savedDate !== null && <p className={smallMutedClasses}>{WINDOW.saved(savedDate)}</p>}
      {gpc && <Note icon="shield-check">{WINDOW.gpcNote}</Note>}
      <fieldset className={fieldsetClasses}>
        <legend className={legendClasses}>{WINDOW.legend}</legend>
        <div>
          <p className={necessaryHeadClasses}>
            {WINDOW.necessary.title}
            <Badge tone="neutral">{WINDOW.necessary.badge}</Badge>
          </p>
          <p className={smallMutedClasses}>{WINDOW.necessary.hint}</p>
        </div>
        <div>
          <Checkbox
            label={WINDOW.stats.title}
            hint={gpc ? WINDOW.stats.gpcHint : WINDOW.stats.hint}
            checked={boxes.stats}
            ariaDisabled={gpc}
            onChange={(stats) => {
              setEdits((previous) => ({ ...previous, stats }));
            }}
          />
        </div>
        <div>
          <Checkbox
            label={WINDOW.map.title}
            hint={WINDOW.map.hint}
            checked={boxes.map}
            onChange={(map) => {
              setEdits((previous) => ({ ...previous, map }));
            }}
          />
        </div>
      </fieldset>
    </Modal>
  );
}
