// The root route owns the query client, and the client is cleared when its owner ends or changes, whichever routes are
// mounted at that moment (shared workstation, WR-14, CWE-200).
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, describe, expect, it } from 'vitest';
import { sessionsListKey } from '@/lib/query/keys';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { sessionResponse } from '@/test/sessionFixtures';
import { Root } from './Root';

// The client Root created, as seen from the page that is mounted.
const seen: { client?: QueryClient | undefined } = {};

/** Stands in for an admin page that fills the cache. */
function SeedingPage() {
  const client = useQueryClient();
  useEffect(() => {
    seen.client = client;
    client.setQueryData(sessionsListKey, [{ id: 'a-device' }]);
  }, [client]);
  return <p>The admin page</p>;
}

/** Stands in for a page outside the admin shell, such as the reset-password page. */
function PlainPage() {
  const client = useQueryClient();
  useEffect(() => {
    seen.client = client;
  }, [client]);
  return <p>The reset page</p>;
}

function renderApp() {
  const router = createMemoryRouter(
    [
      {
        Component: Root,
        children: [
          { path: '/admin/seed', Component: SeedingPage },
          { path: '/admin/reset-password', Component: PlainPage },
        ],
      },
    ],
    { initialEntries: ['/admin/seed'] },
  );
  const view = render(<RouterProvider router={router} />);
  return { router, view };
}

const PERSON_B = { ...sessionResponse().user, id: 'another-person' };

afterEach(() => {
  clearSession();
  seen.client = undefined;
});

describe('Root cache owner', () => {
  it('empties the cache on sign-out after the admin page unmounted', async () => {
    acceptSession(sessionResponse());
    const { router } = renderApp();
    expect(await screen.findByText('The admin page')).toBeInTheDocument();
    expect(seen.client?.getQueryData(sessionsListKey)).toBeDefined();
    await act(async () => {
      await router.navigate('/admin/reset-password');
    });
    expect(await screen.findByText('The reset page')).toBeInTheDocument();

    act(() => {
      clearSession();
    });
    act(() => {
      acceptSession(sessionResponse({ user: PERSON_B }));
    });

    expect(seen.client?.getQueryData(sessionsListKey)).toBeUndefined();
  });

  it('empties the cache when another person signs in with no sign-out between', async () => {
    acceptSession(sessionResponse());
    const { router } = renderApp();
    expect(await screen.findByText('The admin page')).toBeInTheDocument();
    await act(async () => {
      await router.navigate('/admin/reset-password');
    });
    expect(await screen.findByText('The reset page')).toBeInTheDocument();
    expect(seen.client?.getQueryData(sessionsListKey)).toBeDefined();

    act(() => {
      acceptSession(sessionResponse({ user: PERSON_B }));
    });

    expect(seen.client?.getQueryData(sessionsListKey)).toBeUndefined();
  });

  it('keeps the cache for the same person (a refresh)', async () => {
    acceptSession(sessionResponse());
    renderApp();
    expect(await screen.findByText('The admin page')).toBeInTheDocument();

    act(() => {
      acceptSession(sessionResponse());
    });

    expect(seen.client?.getQueryData(sessionsListKey)).toBeDefined();
  });

  it('stops clearing once the app is unmounted', async () => {
    acceptSession(sessionResponse());
    const { view } = renderApp();
    expect(await screen.findByText('The admin page')).toBeInTheDocument();
    const client = seen.client;
    view.unmount();

    act(() => {
      clearSession();
    });

    expect(client?.getQueryData(sessionsListKey)).toBeDefined();
  });
});
