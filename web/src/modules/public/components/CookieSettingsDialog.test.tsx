// CS1, the Cookie Settings window (ANL-01, ANL-03, ANL-07, D-17, D-20, D-34, D-36), opened through the footer button and
// the real ConsentSlot, so the lazy chunk, the store and the focus rules are the ones a visitor gets.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { consentCookie, consentProbe, demoDecision, setConsent } from '@/test/consentFixtures';
import { server } from '@/test/msw';
import { demoSite, putBootBlock } from '@/test/publicFixtures';
import { formatConsentCookie, parseConsentCookie } from '../consentCookie';
import { consentStore } from '../hooks/useConsent';
import { ConsentSlot } from './ConsentSlot';
import { SiteFooter } from './SiteFooter';

// The window and the bar are lazy chunks; the first transform of their parts can take longer than a test waits, so load them first.
beforeAll(async () => {
  await import('./CookieSettingsDialog');
  await import('./ConsentBar');
}, 30_000);

const TODAY = '2026-11-17';
const SAVED_LINE =
  "You chose on Nov 15, 2026. We'll ask again after 12 months, or sooner if our Cookie Policy changes.";

/** A choice made on 15 Nov 2026 that still counts on the fixed "today". */
function setSaved(overrides: Parameters<typeof consentCookie>[0] = {}, gpc = false) {
  return setConsent({ cookie: consentCookie({ decidedOn: '2026-11-15', ...overrides }), gpc, today: () => TODAY });
}

function box(dialog: HTMLElement, name: string): HTMLElement {
  return within(dialog).getByRole('checkbox', { name });
}

function footerOf(dialog: HTMLElement): HTMLElement {
  const footer = dialog.querySelector('footer');
  if (footer === null) throw new Error('The window has no footer.');
  return footer;
}

function cookieBar(): HTMLElement {
  return screen.getByRole('region', { name: 'Cookie choices' });
}

function renderPage() {
  putBootBlock(demoSite);
  return render(
    <MemoryRouter>
      <SiteFooter variant="base" />
      <main id="main" tabIndex={-1} />
      <ConsentSlot />
    </MemoryRouter>,
  );
}

function footerButton(): HTMLElement {
  return within(screen.getByRole('navigation', { name: 'Legal' })).getByRole('button', { name: 'Cookie Settings' });
}

async function openWindow(): Promise<HTMLElement> {
  await userEvent.click(footerButton());
  return screen.findByRole('dialog', { name: 'Cookie Settings' });
}

describe('Cookie Settings from the footer (ANL-03, D-17)', () => {
  it('opens the window with focus inside it', async () => {
    setConsent();
    renderPage();

    const dialog = await openWindow();

    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(within(dialog).getByRole('checkbox', { name: 'Visitor stats' })).toBeInTheDocument();
    expect(within(dialog).getByRole('checkbox', { name: 'Google map' })).toBeInTheDocument();
  });

  it('saves a ticked Visitor stats as source "settings", closes, returns focus to the button and announces it', async () => {
    const probe = consentProbe();
    const jar = setConsent();
    const { container } = renderPage();
    const dialog = await openWindow();

    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Visitor stats' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save Choices' }));

    expect(parseConsentCookie(jar.value)).toMatchObject({ stats: true, map: false });
    await waitFor(() => {
      expect(probe.requests).toHaveLength(1);
    });
    expect(probe.requests[0]?.body).toMatchObject({ stats: true, map: false, source: 'settings' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(footerButton()).toHaveFocus();
    });
    expect(container.querySelector('[data-consent-status]')).toHaveTextContent('Your cookie choice is saved.');
  });

  it('saves Reject All from the window as source "settings", closes it and returns focus to the button', async () => {
    const probe = consentProbe();
    const jar = setSaved({ stats: true, map: true });
    renderPage();
    const dialog = await openWindow();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Reject All' }));

    expect(parseConsentCookie(jar.value)).toMatchObject({ stats: false, map: false });
    await waitFor(() => {
      expect(probe.requests[0]?.body).toMatchObject({ stats: false, map: false, source: 'settings' });
    });
    await waitFor(() => {
      expect(footerButton()).toHaveFocus();
    });
  });

  it('is no longer pending once the window has opened', async () => {
    setConsent();
    renderPage();
    await openWindow();

    expect(consentStore.getSnapshot().settingsLoading).toBe(false);
    expect(footerButton()).not.toHaveAttribute('aria-busy');
  });
});

describe('the window body (CS1 body, D-36)', () => {
  it('shows the description, a Cookie Policy link that closes the window, and the Necessary row without a box', async () => {
    setConsent();
    renderPage();
    const dialog = await openWindow();

    expect(
      within(dialog).getByText(
        'Choose which cookies this site may use. You can change this at any time from Cookie Settings at the bottom of every page.',
      ),
    ).toBeInTheDocument();
    const necessary = within(dialog).getByText('Necessary');
    expect(necessary).toBeInTheDocument();
    expect(within(dialog).getByText('Always on')).toBeInTheDocument();
    expect(
      within(dialog).getByText("Keeps the site working: your cookie choice and staff sign-in. These don't track you."),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole('checkbox', { name: 'Necessary' })).not.toBeInTheDocument();
    expect(within(within(dialog).getByRole('group', { name: 'Your choices' })).getAllByRole('checkbox')).toHaveLength(
      2,
    );

    const link = within(dialog).getByRole('link', { name: 'Read the Cookie Policy' });
    expect(link).toHaveAttribute('href', '/cookies');
    await userEvent.click(link);
    expect(consentStore.getSnapshot().settingsOpen).toBe(false);
  });

  it('words the Visitor stats and Google map hints as D-36 and the UI spec say', async () => {
    setConsent();
    renderPage();
    const dialog = await openWindow();

    expect(
      within(dialog).getByText(
        'Counts visits, pages, where visitors came from and how fast pages load. No ads. Records are kept for about 13 months.',
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText('Shows the shop map from Google on the Contact page. Google may set its own cookies.'),
    ).toBeInTheDocument();
  });

  it('starts both boxes unticked, with no saved-choice line and no GPC note, when nothing is saved', async () => {
    setConsent({ cookie: null });
    renderPage();
    const dialog = await openWindow();

    expect(box(dialog, 'Visitor stats')).not.toBeChecked();
    expect(box(dialog, 'Google map')).not.toBeChecked();
    expect(within(dialog).queryByText(/You chose on/)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/asked us not to track you/)).not.toBeInTheDocument();
  });

  it('shows the saved choice in the boxes and the en-PH date line', async () => {
    setSaved({ stats: true, map: false });
    renderPage();
    const dialog = await openWindow();

    expect(box(dialog, 'Visitor stats')).toBeChecked();
    expect(box(dialog, 'Google map')).not.toBeChecked();
    expect(within(dialog).getByText(SAVED_LINE)).toBeInTheDocument();
  });

  it('shows a saved map-only-on choice with Visitor stats off', async () => {
    setSaved({ stats: false, map: true });
    renderPage();
    const dialog = await openWindow();

    expect(box(dialog, 'Visitor stats')).not.toBeChecked();
    expect(box(dialog, 'Google map')).toBeChecked();
  });

  it('lets the visitor tick a box on top of a saved choice and leaves the other box alone', async () => {
    setSaved({ stats: false, map: false });
    renderPage();
    const dialog = await openWindow();

    await userEvent.click(box(dialog, 'Google map'));

    expect(box(dialog, 'Google map')).toBeChecked();
    expect(box(dialog, 'Visitor stats')).not.toBeChecked();
  });

  it('shows Reject All, Accept All and one primary Save Choices in the footer, in that order', async () => {
    setConsent();
    renderPage();
    const dialog = await openWindow();
    const buttons = within(footerOf(dialog)).getAllByRole('button');

    expect(buttons.map((button) => button.textContent)).toEqual(['Reject All', 'Accept All', 'Save Choices']);
    expect(buttons.filter((button) => button.className.includes('bg-primary')).map((b) => b.textContent)).toEqual([
      'Save Choices',
    ]);
  });
});

describe('Global Privacy Control (D-20)', () => {
  it('shows the note, locks Visitor stats off with its own hint, and keeps the Google map box working', async () => {
    setConsent({ cookie: null, gpc: true });
    renderPage();
    const dialog = await openWindow();

    expect(
      within(dialog).getByText('Your browser asked us not to track you, so visitor stats stay off.'),
    ).toBeVisible();
    const stats = box(dialog, 'Visitor stats');
    expect(stats).toHaveAttribute('aria-disabled', 'true');
    expect(stats).not.toBeChecked();
    expect(within(dialog).getByText('Off, because your browser asked us not to track you.')).toBeInTheDocument();
    expect(within(dialog).queryByText(/Counts visits, pages/)).not.toBeInTheDocument();

    await userEvent.click(stats);
    expect(stats).not.toBeChecked();
    await userEvent.click(box(dialog, 'Google map'));
    expect(box(dialog, 'Google map')).toBeChecked();
  });

  it('shows only Save Choices in the footer', async () => {
    setConsent({ cookie: null, gpc: true });
    renderPage();
    const dialog = await openWindow();

    expect(
      within(footerOf(dialog))
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Save Choices']);
  });

  it('saves Visitor stats off and the ticked map, and never shows a saved stats tick', async () => {
    const probe = consentProbe();
    setSaved({ stats: true, map: true }, true);
    renderPage();
    const dialog = await openWindow();
    expect(box(dialog, 'Visitor stats')).not.toBeChecked();
    expect(box(dialog, 'Google map')).toBeChecked();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Save Choices' }));

    await waitFor(() => {
      expect(probe.requests[0]?.body).toMatchObject({ stats: false, map: true, source: 'settings' });
    });
  });
});

describe('opened from the cookie bar (D-34, ANL-01)', () => {
  async function openFromBar(): Promise<HTMLElement> {
    renderPage();
    await userEvent.click(within(cookieBar()).getByRole('button', { name: 'Cookie Settings' }));
    return screen.findByRole('dialog', { name: 'Cookie Settings' });
  }

  it('starts with nothing ticked and no saved line on a first visit', async () => {
    setConsent({ cookie: null });
    const dialog = await openFromBar();

    expect(box(dialog, 'Visitor stats')).not.toBeChecked();
    expect(box(dialog, 'Google map')).not.toBeChecked();
    expect(within(dialog).queryByText(/You chose on/)).not.toBeInTheDocument();
  });

  it('starts with nothing ticked when the old choice no longer counts (a new Cookie Policy version)', async () => {
    setConsent({ cookie: consentCookie({ policyVersion: '0.0', stats: true, map: true }) });
    const dialog = await openFromBar();

    expect(box(dialog, 'Visitor stats')).not.toBeChecked();
    expect(box(dialog, 'Google map')).not.toBeChecked();
    expect(within(dialog).queryByText(/You chose on/)).not.toBeInTheDocument();
  });

  it('starts with nothing ticked after a map-only save, while the bar still asks', async () => {
    setConsent({ cookie: consentCookie({ stats: null, map: true }) });
    const dialog = await openFromBar();

    expect(box(dialog, 'Google map')).not.toBeChecked();
  });

  it('keeps the bar and returns focus to its Cookie Settings button when closed without saving', async () => {
    const jar = setConsent({ cookie: null });
    const probe = consentProbe();
    await openFromBar();

    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(cookieBar()).toBeInTheDocument();
    expect(within(cookieBar()).getByRole('button', { name: 'Cookie Settings' })).toHaveFocus();
    expect(jar.writes).toEqual([]);
    expect(probe.requests).toEqual([]);
  });

  it('closes the window and the bar on Save Choices, moves focus to main and announces it', async () => {
    const jar = setConsent({ cookie: null });
    const probe = consentProbe();
    const dialog = await openFromBar();

    await userEvent.click(box(dialog, 'Google map'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save Choices' }));

    await waitFor(() => {
      expect(screen.queryByRole('region', { name: 'Cookie choices' })).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('main')).toHaveFocus();
    });
    expect(parseConsentCookie(jar.value)).toMatchObject({ stats: false, map: true });
    await waitFor(() => {
      expect(probe.requests[0]?.body).toMatchObject({ source: 'settings' });
    });
    expect(document.querySelector('[data-consent-status]')).toHaveTextContent('Your cookie choice is saved.');
  });

  it('closes both and focuses main on Accept All from the window', async () => {
    const jar = setConsent({ cookie: null });
    consentProbe();
    const dialog = await openFromBar();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Accept All' }));

    await waitFor(() => {
      expect(screen.getByRole('main')).toHaveFocus();
    });
    expect(parseConsentCookie(jar.value)).toMatchObject({ stats: true, map: true });
    expect(screen.queryByRole('region', { name: 'Cookie choices' })).not.toBeInTheDocument();
  });
});

describe('Clear my cookies & data (CS1 item 5, CS2, ANL-04, D-19, D-31, D-35)', () => {
  const NEW_CHAIN = 'fedcba9876543210fedcba9876543210';
  const CLEAR_TITLE = 'Clear your cookies and data?';
  const DONE = "Done. The optional cookies and your visit records are deleted. Visitor stats and the map are now off.";

  beforeEach(() => {
    localStorage.setItem('csps-admin-theme', 'espresso');
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  /** The server answers Clear and the browser accepts its Set-Cookie for the reset decision. */
  function clearAnswers(jar: ReturnType<typeof setSaved>) {
    server.use(
      http.post('*/api/v1/analytics/clear', () => {
        jar.value = formatConsentCookie(
          consentCookie({ consentId: NEW_CHAIN, stats: false, map: false, decidedOn: TODAY }),
        );
        return HttpResponse.json({ ...demoDecision, consentId: NEW_CHAIN, stats: false, map: false });
      }),
    );
  }

  function clearButton(dialog: HTMLElement): HTMLElement {
    return within(dialog).getByRole('button', { name: 'Clear My Cookies & Data' });
  }

  it('ends the window with the Clear section after the choices', async () => {
    setSaved({ stats: true, map: true });
    renderPage();
    const dialog = await openWindow();

    const heading = within(dialog).getByRole('heading', { level: 3, name: 'Clear my cookies & data' });
    expect(
      within(dialog).getByText(
        "Removes the optional cookies and saved settings from this browser, and deletes the visit records linked to it on our server. The cookies the site needs stay.",
      ),
    ).toBeInTheDocument();
    expect(clearButton(dialog)).toBeInTheDocument();
    const group = within(dialog).getByRole('group', { name: 'Your choices' });
    expect(group.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(footerOf(dialog).contains(heading)).toBe(false);
  });

  it('opens the confirmation with focus on Keep My Data, and Keep My Data closes it and returns focus to the button', async () => {
    setSaved({ stats: true, map: true });
    renderPage();
    const dialog = await openWindow();

    await userEvent.click(clearButton(dialog));
    const confirm = await screen.findByRole('dialog', { name: CLEAR_TITLE });
    expect(within(confirm).getByRole('button', { name: 'Keep My Data' })).toHaveFocus();
    await userEvent.click(within(confirm).getByRole('button', { name: 'Keep My Data' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: CLEAR_TITLE })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('dialog', { name: 'Cookie Settings' })).toBeInTheDocument();
    expect(clearButton(dialog)).toHaveFocus();
    expect(localStorage.getItem('csps-admin-theme')).toBe('espresso');
  });

  it('after Clear My Data closes the confirmation, keeps the window open with both boxes unticked, returns focus and says Done', async () => {
    const jar = setSaved({ stats: true, map: true });
    clearAnswers(jar);
    renderPage();
    const dialog = await openWindow();
    expect(box(dialog, 'Visitor stats')).toBeChecked();
    expect(box(dialog, 'Google map')).toBeChecked();

    await userEvent.click(clearButton(dialog));
    const confirm = await screen.findByRole('dialog', { name: CLEAR_TITLE });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Clear My Data' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: CLEAR_TITLE })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('dialog', { name: 'Cookie Settings' })).toBeInTheDocument();
    expect(box(dialog, 'Visitor stats')).not.toBeChecked();
    expect(box(dialog, 'Google map')).not.toBeChecked();
    expect(clearButton(dialog)).toHaveFocus();
    expect(within(dialog).getByRole('status')).toHaveTextContent(DONE);
    expect(localStorage.length).toBe(0);
    expect(parseConsentCookie(jar.value)).toMatchObject({ consentId: NEW_CHAIN, stats: false, map: false });
    expect(screen.queryByRole('region', { name: 'Cookie choices' })).not.toBeInTheDocument();
  });

  it('shows no Done line before Clear is pressed, and none after a failed clear', async () => {
    setSaved({ stats: true, map: true });
    server.use(http.post('*/api/v1/analytics/clear', () => HttpResponse.error()));
    renderPage();
    const dialog = await openWindow();
    expect(within(dialog).queryByText(DONE)).not.toBeInTheDocument();

    await userEvent.click(clearButton(dialog));
    const confirm = await screen.findByRole('dialog', { name: CLEAR_TITLE });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Clear My Data' }));

    expect(await within(confirm).findByRole('alert')).toHaveTextContent(
      "Couldn't clear your data. Check your internet connection and try again.",
    );
    expect(within(dialog).queryByText(DONE)).not.toBeInTheDocument();
    expect(box(dialog, 'Visitor stats')).toBeChecked();
    expect(localStorage.getItem('csps-admin-theme')).toBe('espresso');
  });

  it('still offers the Clear section under Global Privacy Control', async () => {
    setConsent({ cookie: null, gpc: true });
    renderPage();
    const dialog = await openWindow();

    expect(clearButton(dialog)).toBeInTheDocument();
  });

  it('has no axe violations with the section, with the confirmation open and after Done', async () => {
    const jar = setSaved({ stats: true, map: true });
    clearAnswers(jar);
    const { container } = renderPage();
    const dialog = await openWindow();
    await expectNoAxeViolations(container);

    await userEvent.click(clearButton(dialog));
    const confirm = await screen.findByRole('dialog', { name: CLEAR_TITLE });
    await expectNoAxeViolations(container);
    await userEvent.click(within(confirm).getByRole('button', { name: 'Clear My Data' }));
    await waitFor(() => {
      expect(within(dialog).getByRole('status')).toHaveTextContent(DONE);
    });

    await expectNoAxeViolations(container);
  });
});

describe('the window at 320px and its accessibility (UI-SPEC long-text, A11Y)', () => {
  it('lets the hints wrap under their boxes and the footer buttons wrap and fill the row on a phone', async () => {
    setConsent();
    renderPage();
    const dialog = await openWindow();
    const group = within(dialog).getByRole('group', { name: 'Your choices' });
    const footer = footerOf(dialog);

    expect(group.className.split(' ')).toContain('min-w-0');
    expect(footer.className.split(' ')).toEqual(expect.arrayContaining(['flex-wrap', 'vp-lt-sm:*:flex-1']));
  });

  it.each([
    ['no saved choice', () => setConsent({ cookie: null })],
    ['a saved choice', () => setSaved({ stats: true, map: false })],
    ['Global Privacy Control', () => setConsent({ cookie: null, gpc: true })],
  ])('has no axe violations with %s', async (_name, arrange) => {
    arrange();
    const { container } = renderPage();
    await openWindow();

    await expectNoAxeViolations(container);
  });
});
