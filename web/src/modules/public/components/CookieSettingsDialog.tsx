// CS1: the Cookie Settings window (ANL-01, ANL-03, ANL-07, D-17, D-20, D-34, D-36). Its own lazy chunk: ConsentSlot loads
// it while the window is open, so no public page's first download carries it (PERF-01).
// SPEC-GAP: CS1 has no spec markup beyond the UI-SPEC section; it is a Modal (a bottom sheet at 639px and below) with the
// choices in a fieldset and the three buttons in the footer.
//   - The boxes start from the saved choice, and unticked when none is saved or while the bar still asks (D-34). What the
//     visitor ticks is kept apart from that, so a later change to the saved choice never undoes a tick.
//   - A choice closes the window first and is then saved, so the "saved" line is read while the page is live again. When
//     the bar was showing, focus goes to `main` once the bar has closed; otherwise it goes back to the opener.
import { useEffect, useState } from 'react';
import { Button } from '@/components/actions/Button';
import { Checkbox } from '@/components/entry/Checkbox';
import { Modal } from '@/components/overlays/Modal';
import { CONSENT_COPY } from '../consentCopy';
import { focusMain } from '../consentFocus';
import { consentStore, useConsent } from '../hooks/useConsent';
import { fieldsetClasses, legendClasses } from './consent.recipe';

// The save path starts loading with the window, so a click applies the choice at once (it is not in the first download).
void import('../consentSave');

const { window: WINDOW } = CONSENT_COPY;

interface Boxes {
  stats: boolean;
  map: boolean;
}

/** Resolves once the cookie bar has closed, or at once when it is not showing. */
function barClosed(): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      if (!consentStore.getSnapshot().needsChoice) {
        stop();
        resolve();
      }
    };
    const stop = consentStore.subscribe(check);
    check();
  });
}

export function CookieSettingsDialog() {
  const { needsChoice, statsAllowed, mapAllowed, save, acceptAll, rejectAll, closeSettings, settingsReady } =
    useConsent();
  const [edits, setEdits] = useState<Partial<Boxes>>({});
  const boxes: Boxes = {
    stats: edits.stats ?? (!needsChoice && statsAllowed),
    map: edits.map ?? (!needsChoice && mapAllowed),
  };

  useEffect(() => {
    settingsReady();
  }, [settingsReady]);

  const choose = (run: () => Promise<void>) => {
    const barWasOpen = needsChoice;
    closeSettings();
    void run();
    if (barWasOpen) void barClosed().then(focusMain);
  };

  return (
    <Modal
      title={WINDOW.title}
      onClose={closeSettings}
      footer={
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
      <fieldset className={fieldsetClasses}>
        <legend className={legendClasses}>{WINDOW.legend}</legend>
        <div>
          <Checkbox
            label={WINDOW.stats.title}
            hint={WINDOW.stats.hint}
            checked={boxes.stats}
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
