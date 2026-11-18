// Dev-only scenario wrapper (plan 12-29; never shipped, D-20): the Cookie Settings window (CS1) open in one state, on a
// seeded consent store with no network (./demoConsent):
//   - `no-choice`: nothing ticked, with Reject All, Accept All and Save Choices;
//   - `saved`: the saved choice ticked and the "You chose on" line, once the cookie rules have loaded;
//   - `gpc`: the GPC Note, Visitor stats locked off, only Save Choices;
//   - `cleared` and `clear-failed`: after mount it presses Clear My Cookies & Data, then Clear My Data, as a person would.
//     The stand-in answers 2xx (the window shows the Done Note, both boxes unticked) or a 500 (the confirmation keeps the
//     failure line).
// The window shows while the store says it is open. `onClosed` (showcase demos only) runs once it has closed again.
import { useEffect, useRef } from 'react';
import { CONSENT_COPY } from '@/modules/public/consentCopy';
import { CookieSettingsDialog } from '@/modules/public/components/CookieSettingsDialog';
import { consentStore, useConsent } from '@/modules/public/hooks/useConsent';
import { seedDemoConsent, type DemoConsentState } from './demoConsent';

export interface OpenedCookieSettingsProps {
  state: DemoConsentState;
  onClosed?: () => void;
}

/** Clicks the open dialog button that reads `text`. */
function press(text: string): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button');
  [...buttons].find((button) => button.textContent.trim() === text)?.click();
}

export function OpenedCookieSettings({ state, onClosed }: OpenedCookieSettingsProps) {
  const { settingsOpen } = useConsent();
  const opened = useRef(false);
  const pressed = useRef(false);

  useEffect(() => {
    seedDemoConsent(state);
    consentStore.openSettings();
  }, [state]);

  useEffect(() => {
    if (settingsOpen) {
      opened.current = true;
    } else if (opened.current) {
      onClosed?.();
    }
  }, [settingsOpen, onClosed]);

  useEffect(() => {
    // Once only: a development re-run of the effect must not press twice.
    if (!settingsOpen || pressed.current || (state !== 'cleared' && state !== 'clear-failed')) return;
    pressed.current = true;
    press(CONSENT_COPY.clear.button);
    // After React has opened the confirmation.
    window.setTimeout(() => {
      press(CONSENT_COPY.clear.dialog.confirm);
    }, 0);
  }, [settingsOpen, state]);

  return settingsOpen ? <CookieSettingsDialog /> : null;
}
