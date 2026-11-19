// The page-view beacon (ANL-06, D-53): every public view is sent at once with the path only, with no wait for a cookie choice.
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { Link, MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pageViewProbe } from '@/test/msw';
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

describe('usePageViewBeacon (D-53)', () => {
  it('sends the first view at once with the path only', async () => {
    const probe = pageViewProbe();

    render(
      <MemoryRouter initialEntries={['/gallery']}>
        <Beacon />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(probe.requests).toHaveLength(1);
    });
    expect(probe.requests[0]?.body).toEqual({ path: '/gallery' });
    expect(probe.requests[0]?.csrf).toBe('1');
  });

  it('sends the location path only, never the query or the fragment', async () => {
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
  });

  it('never adds a referrer host', async () => {
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
    expect(Object.keys(probe.requests[0]?.body as object).join(',')).toBe('path');
  });

  it('sends each new path once', async () => {
    const probe = pageViewProbe();
    render(
      <MemoryRouter initialEntries={['/']}>
        <Beacon />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(probe.requests).toHaveLength(1);
    });

    await userEvent.click(screen.getByRole('link', { name: 'Products' }));
    await waitFor(() => {
      expect(probe.requests).toHaveLength(2);
    });
    await userEvent.click(screen.getByRole('link', { name: 'Products' }));
    await settle();

    expect(probe.requests.map((request) => request.body)).toEqual([{ path: '/' }, { path: '/products' }]);
  });

  it('does not send again when the page is hidden', async () => {
    const probe = pageViewProbe();
    render(
      <MemoryRouter initialEntries={['/']}>
        <Beacon />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(probe.requests).toHaveLength(1);
    });

    act(() => {
      hidePage();
    });
    await settle();

    expect(probe.requests).toHaveLength(1);
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

  it('drops a failed send quietly: one call, no retry and nothing logged', async () => {
    const probe = pageViewProbe(500);
    render(
      <MemoryRouter initialEntries={['/contact']}>
        <Beacon />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(probe.requests).toHaveLength(1);
    });
    await settle();

    expect(probe.requests).toHaveLength(1);
  });
});

describe('usePageViewBeacon out of scope paths', () => {
  it.each(['/admin', '/admin/orders', '/dev/components', '/dev/public'])('skips %s', async (path) => {
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

describe('createBeaconMachine', () => {
  const sender = () => vi.fn<BeaconSend>(() => Promise.resolve());

  it('sends a view at once with the path only', () => {
    const send = sender();
    const machine = createBeaconMachine(send);

    machine.view('/');

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ path: '/' });
  });

  it('counts the same path once when it is announced twice in a row', () => {
    const send = sender();
    const machine = createBeaconMachine(send);

    machine.view('/');
    machine.view('/');
    machine.view('/products');
    machine.view('/');

    expect(send.mock.calls.map(([body]) => body)).toEqual([{ path: '/' }, { path: '/products' }, { path: '/' }]);
  });

  it('swallows a rejected send without a retry', async () => {
    const send = vi.fn<BeaconSend>(() => Promise.reject(new Error('Failed to fetch')));
    const machine = createBeaconMachine(send);

    machine.view('/');
    machine.view('/products');
    await settle();

    expect(send).toHaveBeenCalledTimes(2);
  });
});
