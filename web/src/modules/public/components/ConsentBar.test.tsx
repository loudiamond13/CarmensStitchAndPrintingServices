// CB1, the cookie bar (ANL-01, ANL-07, D-16, D-17): its copy, its three buttons in order, and the save from Accept All.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { consentProbe, setConsent } from '@/test/consentFixtures';
import { parseConsentCookie } from '../consentCookie';
import { ConsentBar } from './ConsentBar';

function renderBar() {
  return render(
    <MemoryRouter>
      <main id="main" tabIndex={-1} />
      <ConsentBar />
    </MemoryRouter>,
  );
}

function region(): HTMLElement {
  return screen.getByRole('region', { name: 'Cookie choices' });
}

describe('ConsentBar markup (CB1)', () => {
  it('is a section named "Cookie choices" with the spec text and a Cookie Policy link to /cookies', () => {
    setConsent({ cookie: null });
    renderBar();
    expect(region().tagName).toBe('SECTION');
    expect(region()).toHaveTextContent(
      'We use cookies for visitor stats and the Google map, only if you say yes. See our Cookie Policy.',
    );
    expect(within(region()).getByRole('link', { name: 'Cookie Policy' })).toHaveAttribute('href', '/cookies');
  });

  it('holds Cookie Settings, Reject All and Accept All, in that order', () => {
    setConsent({ cookie: null });
    renderBar();
    expect(
      within(region())
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Cookie Settings', 'Reject All', 'Accept All']);
  });
});

describe('ConsentBar equal choice (D-16, ANL-01)', () => {
  it('gives Reject All and Accept All one class string and one rendered size', () => {
    setConsent({ cookie: null });
    renderBar();
    const reject = within(region()).getByRole('button', { name: 'Reject All' });
    const accept = within(region()).getByRole('button', { name: 'Accept All' });
    expect(accept.className).toBe(reject.className);
    expect(accept.getBoundingClientRect().width).toBe(reject.getBoundingClientRect().width);
    expect(accept.getBoundingClientRect().height).toBe(reject.getBoundingClientRect().height);
  });

  it('pre-focuses nothing, is not a live region and holds no primary button', () => {
    setConsent({ cookie: null });
    renderBar();
    expect(document.body).toHaveFocus();
    expect(region().querySelector('[aria-live], [role="alert"], [role="status"]')).toBeNull();
    for (const button of within(region()).getAllByRole('button')) {
      expect(button.className).not.toContain('bg-primary');
    }
  });

  it('saves stats and map off from Reject All and moves focus to main', async () => {
    const probe = consentProbe();
    const jar = setConsent({ cookie: null });
    renderBar();

    await userEvent.click(within(region()).getByRole('button', { name: 'Reject All' }));

    expect(parseConsentCookie(jar.value)).toMatchObject({ stats: false, map: false });
    await waitFor(() => {
      expect(probe.requests).toHaveLength(1);
    });
    expect(probe.requests[0]?.body).toMatchObject({ stats: false, map: false, source: 'bar' });
    expect(screen.getByRole('main')).toHaveFocus();
  });
});

describe('ConsentBar phone layout (UI-SPEC CB1, overflow)', () => {
  it('uses the phone grid: Reject All and Accept All in equal halves, Cookie Settings full width under them', () => {
    setConsent({ cookie: null });
    renderBar();
    const settings = within(region()).getByRole('button', { name: 'Cookie Settings' });
    const reject = within(region()).getByRole('button', { name: 'Reject All' });
    const grid = settings.parentElement;

    expect(grid?.className.split(' ')).toEqual(
      expect.arrayContaining(['pg-phone:grid', 'pg-phone:grid-cols-2', 'gap-2']),
    );
    expect(reject.className.split(' ')).toEqual(expect.arrayContaining(['pg-phone:w-full']));
    expect(settings.className.split(' ')).toEqual(
      expect.arrayContaining(['pg-phone:order-last', 'pg-phone:col-span-2', 'pg-phone:w-full']),
    );
  });

  it('lets the text wrap and never scroll sideways: the text may shrink and the bar has no fixed width', () => {
    setConsent({ cookie: null });
    renderBar();
    const text = region().querySelector('p');
    expect(text?.className.split(' ')).toContain('min-w-0');
    expect(region().className).not.toMatch(/(?:^| )w-\d/);
  });

  it('opens the settings window state from Cookie Settings and keeps the bar', async () => {
    const jar = setConsent({ cookie: null });
    renderBar();
    await userEvent.click(within(region()).getByRole('button', { name: 'Cookie Settings' }));
    expect(jar.writes).toEqual([]);
    expect(region()).toBeInTheDocument();
  });

  it('has no axe violations while open', async () => {
    setConsent({ cookie: null });
    const { container } = renderBar();
    await expectNoAxeViolations(container);
  });
});

describe('ConsentBar Accept All (D-17, ANL-07)', () => {
  it('saves stats and map on, posts source "bar" and moves focus to main', async () => {
    const probe = consentProbe();
    const jar = setConsent({ cookie: null });
    renderBar();

    await userEvent.click(within(region()).getByRole('button', { name: 'Accept All' }));

    expect(parseConsentCookie(jar.value)).toMatchObject({ stats: true, map: true });
    await waitFor(() => {
      expect(probe.requests).toHaveLength(1);
    });
    expect(probe.requests[0]?.body).toMatchObject({ stats: true, map: true, source: 'bar' });
    expect(screen.getByRole('main')).toHaveFocus();
  });
});
