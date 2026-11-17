// The page-view beacon (ANL-05, ANL-06, UI-SPEC CB1 "After the choice"): the hook sends the path only, and the machine
// holds the landing view while the bar asks.
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { Link, MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { consentCookie, setConsent } from '@/test/consentFixtures';
import { pageViewProbe } from '@/test/msw';
import { consentStore } from './useConsent';
import { type BeaconSend, createBeaconMachine, usePageViewBeacon } from './usePageViewBeacon';

function Beacon() {
  usePageViewBeacon(useLocation().pathname);
  return <Link to="/products">Products</Link>;
}

function setReferrer(value: string): void {
  Object.defineProperty(document, 'referrer', { configurable: true, value });
}

function hidePage(): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
}

/** Lets any request that was going to be sent reach the probe. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 60));

afterEach(() => {
  setReferrer('');
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});

describe('usePageViewBeacon tracer (ANL-05)', () => {
  it('sends only { path } for /gallery?q=jersey#top when a choice is saved and there is no referrer', async () => {
    const probe = pageViewProbe();

    render(
      <MemoryRouter initialEntries={['/gallery?q=jersey#top']}>
        <Beacon />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(probe.requests).toHaveLength(1);
    });
    expect(probe.requests[0]?.body).toEqual({ path: '/gallery' });
    expect(probe.requests[0]?.csrf).toBe('1');
  });

  it('adds the referrer hostname, never the full address, to the first view', async () => {
    setReferrer('https://www.example.test/groups/riders?ref=share#top');
    const probe = pageViewProbe();

    render(
      <MemoryRouter initialEntries={['/products']}>
        <Beacon />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(probe.requests).toHaveLength(1);
    });
    expect(probe.requests[0]?.body).toEqual({ path: '/products', referrerHost: 'www.example.test' });
  });

  it('under GPC with no saved choice sends the view at once', async () => {
    setConsent({ cookie: null, gpc: true });
    const probe = pageViewProbe();

    render(
      <MemoryRouter initialEntries={['/contact']}>
        <Beacon />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(probe.requests).toHaveLength(1);
    });
    expect(probe.requests[0]?.body).toEqual({ path: '/contact' });
  });

  it('keeps a saved choice from being read as a reason to wait', async () => {
    setConsent({ cookie: consentCookie({ stats: true, map: true }) });
    const probe = pageViewProbe();

    render(
      <MemoryRouter initialEntries={['/']}>
        <Beacon />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(probe.requests).toHaveLength(1);
    });
  });
});

describe('createBeaconMachine: the landing view while the bar asks (UI-SPEC CB1)', () => {
  const sender = () => vi.fn<BeaconSend>(() => Promise.resolve());

  it('holds the landing view while a choice is needed, sends it once on the choice, and not again', () => {
    const send = sender();
    const machine = createBeaconMachine(send);

    machine.view('/', { landing: true, needsChoice: true });
    expect(send).not.toHaveBeenCalled();
    machine.choiceMade();
    machine.choiceMade();

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ path: '/' });
  });

  it('sends the held view on the next route change, then the new view, each once; a later choice sends nothing', () => {
    const send = sender();
    const machine = createBeaconMachine(send);

    machine.view('/', { landing: true, needsChoice: true });
    machine.view('/gallery', { landing: false, needsChoice: true });
    machine.choiceMade();
    machine.hidden();

    expect(send.mock.calls.map(([body]) => body)).toEqual([{ path: '/' }, { path: '/gallery' }]);
  });

  it('sends the held view with keepalive when the page is hidden, and a later choice sends nothing', () => {
    const send = sender();
    const machine = createBeaconMachine(send);

    machine.view('/', { landing: true, needsChoice: true });
    machine.hidden();
    machine.choiceMade();

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ path: '/' }, { keepalive: true });
  });

  it('sends every view at once when no choice is needed, and only the landing view carries the referrer host', () => {
    const send = sender();
    const machine = createBeaconMachine(send);

    machine.view('/', { landing: true, needsChoice: false, referrerHost: 'www.example.test' });
    machine.view('/products', { landing: false, needsChoice: false, referrerHost: 'www.example.test' });
    machine.choiceMade();
    machine.hidden();

    expect(send.mock.calls.map(([body]) => body)).toEqual([
      { path: '/', referrerHost: 'www.example.test' },
      { path: '/products' },
    ]);
  });

  it('keeps the referrer host on a held landing view', () => {
    const send = sender();
    const machine = createBeaconMachine(send);

    machine.view('/', { landing: true, needsChoice: true, referrerHost: 'www.example.test' });
    machine.choiceMade();

    expect(send).toHaveBeenCalledWith({ path: '/', referrerHost: 'www.example.test' });
  });

  it('leaves an empty referrer host out', () => {
    const send = sender();
    const machine = createBeaconMachine(send);

    machine.view('/', { landing: true, needsChoice: false, referrerHost: '' });

    expect(send).toHaveBeenCalledWith({ path: '/' });
  });

  it('counts the same path once when it is announced twice in a row', () => {
    const send = sender();
    const machine = createBeaconMachine(send);

    machine.view('/', { landing: true, needsChoice: false });
    machine.view('/', { landing: false, needsChoice: false });

    expect(send).toHaveBeenCalledTimes(1);
  });

  it('swallows a rejected send without a retry, on an immediate send and on a flush', async () => {
    const send = vi.fn<BeaconSend>(() => Promise.reject(new Error('Failed to fetch')));
    const machine = createBeaconMachine(send);

    machine.view('/', { landing: true, needsChoice: false });
    machine.view('/products', { landing: true, needsChoice: true });
    machine.choiceMade();
    machine.view('/contact', { landing: true, needsChoice: true });
    machine.hidden();
    await settle();

    expect(send).toHaveBeenCalledTimes(3);
  });
});

describe('usePageViewBeacon with the bar showing (UI-SPEC CB1 "After the choice")', () => {
  it('sends nothing before the choice, then the landing view once when the choice is made', async () => {
    setConsent({ cookie: null });
    const probe = pageViewProbe();
    render(
      <MemoryRouter initialEntries={['/']}>
        <Beacon />
      </MemoryRouter>,
    );
    await settle();
    expect(probe.requests).toHaveLength(0);

    act(() => {
      setConsent({ cookie: consentCookie() });
    });

    await waitFor(() => {
      expect(probe.requests).toHaveLength(1);
    });
    act(() => {
      setConsent({ cookie: consentCookie({ stats: true }) });
    });
    await settle();
    expect(probe.requests).toHaveLength(1);
    expect(probe.requests[0]?.body).toEqual({ path: '/' });
  });

  it('sends the held view when the visitor moves to another page, then that page', async () => {
    setConsent({ cookie: null });
    const probe = pageViewProbe();
    render(
      <MemoryRouter initialEntries={['/']}>
        <Beacon />
      </MemoryRouter>,
    );
    await settle();
    expect(probe.requests).toHaveLength(0);

    await userEvent.click(screen.getByRole('link', { name: 'Products' }));

    await waitFor(() => {
      expect(probe.requests).toHaveLength(2);
    });
    expect(probe.requests.map((request) => request.body)).toEqual(
      expect.arrayContaining([{ path: '/' }, { path: '/products' }]),
    );
    act(() => {
      setConsent({ cookie: consentCookie() });
    });
    await settle();
    expect(probe.requests).toHaveLength(2);
  });

  it('sends the held view when the page is hidden, and not again on the choice', async () => {
    setConsent({ cookie: null });
    const probe = pageViewProbe();
    render(
      <MemoryRouter initialEntries={['/']}>
        <Beacon />
      </MemoryRouter>,
    );
    await settle();
    expect(probe.requests).toHaveLength(0);

    act(() => {
      hidePage();
    });

    await waitFor(() => {
      expect(probe.requests).toHaveLength(1);
    });
    act(() => {
      setConsent({ cookie: consentCookie() });
    });
    await settle();
    expect(probe.requests).toHaveLength(1);
  });

  it('keeps holding while the store changes without a choice and while the page stays visible', async () => {
    setConsent({ cookie: null });
    const probe = pageViewProbe();
    render(
      <MemoryRouter initialEntries={['/']}>
        <Beacon />
      </MemoryRouter>,
    );
    await settle();

    act(() => {
      consentStore.openSettings();
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await settle();

    expect(probe.requests).toHaveLength(0);
  });

  it('stops listening when the layout goes away', async () => {
    setConsent({ cookie: null });
    const probe = pageViewProbe();
    const view = render(
      <MemoryRouter initialEntries={['/']}>
        <Beacon />
      </MemoryRouter>,
    );
    await settle();
    view.unmount();

    act(() => {
      hidePage();
      setConsent({ cookie: consentCookie() });
    });
    await settle();

    expect(probe.requests).toHaveLength(0);
  });

  it('counts one view in React StrictMode, where effects run twice', async () => {
    const probe = pageViewProbe();
    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/contact']}>
          <Beacon />
        </MemoryRouter>
      </StrictMode>,
    );
    await settle();

    expect(probe.requests).toHaveLength(1);
  });
});

describe('usePageViewBeacon out of scope paths', () => {
  it.each(['/admin', '/admin/orders', '/dev/public'])('sends nothing for %s', async (path) => {
    const probe = pageViewProbe();
    render(
      <MemoryRouter initialEntries={[path]}>
        <Beacon />
      </MemoryRouter>,
    );
    await settle();

    expect(probe.requests).toHaveLength(0);
  });

  it('counts /administrator, which is a public not-found path', async () => {
    const probe = pageViewProbe();
    render(
      <MemoryRouter initialEntries={['/administrator']}>
        <Beacon />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(probe.requests).toHaveLength(1);
    });
  });
});
