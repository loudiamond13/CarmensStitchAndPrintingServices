// Focus after a choice (ANL-07, A11Y-02): main takes it once the cookie bar has closed.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { consentProbe, setConsent } from '@/test/consentFixtures';
import { consentStore } from './hooks/useConsent';
import { focusMain, focusMainWhenChosen } from './consentFocus';

let main: HTMLElement;

beforeEach(() => {
  main = document.createElement('main');
  main.id = 'main';
  main.tabIndex = -1;
  document.body.append(main);
});

afterEach(() => {
  main.remove();
});

describe('focusMain', () => {
  it('focuses main, and does nothing when the page has none', () => {
    focusMain();
    expect(main).toHaveFocus();

    main.remove();
    expect(() => {
      focusMain();
    }).not.toThrow();
  });
});

describe('focusMainWhenChosen', () => {
  it('focuses main at once when the bar is not asking', () => {
    setConsent();

    focusMainWhenChosen();

    expect(main).toHaveFocus();
  });

  it('waits while the bar still asks, even through other store changes, then focuses main once a choice applies', async () => {
    consentProbe();
    setConsent({ cookie: null });

    focusMainWhenChosen();
    expect(main).not.toHaveFocus();

    consentStore.openSettings();
    expect(main).not.toHaveFocus();

    await consentStore.rejectAll('settings');
    expect(main).toHaveFocus();
  });
});
