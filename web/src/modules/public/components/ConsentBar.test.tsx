// CB1, the cookie bar (ANL-01, ANL-07, D-16, D-17): its copy, its three buttons in order, and the save from Accept All.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
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
