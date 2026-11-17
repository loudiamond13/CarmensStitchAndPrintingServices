// CS1, the Cookie Settings window (ANL-01, ANL-03, ANL-07, D-17, D-20, D-34, D-36), opened through the footer button and
// the real ConsentSlot, so the lazy chunk, the store and the focus rules are the ones a visitor gets.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeAll, describe, expect, it } from 'vitest';
import { consentProbe, setConsent } from '@/test/consentFixtures';
import { demoSite, putBootBlock } from '@/test/publicFixtures';
import { parseConsentCookie } from '../consentCookie';
import { ConsentSlot } from './ConsentSlot';
import { SiteFooter } from './SiteFooter';

// The window is a lazy chunk; the first transform of its parts can take longer than a test waits, so load it first.
beforeAll(async () => {
  await import('./CookieSettingsDialog');
}, 30_000);

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
});
