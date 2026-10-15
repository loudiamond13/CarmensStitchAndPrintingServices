// The query cache never outlives the person who filled it (shared workstation, WR-14).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { sessionsListKey } from '@/lib/query/keys';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { sessionResponse } from '@/test/sessionFixtures';
import { useClearCacheOnSignOut } from './useClearCacheOnSignOut';

function Watcher() {
  useClearCacheOnSignOut();
  return null;
}

function setup() {
  const client = new QueryClient();
  client.setQueryData(sessionsListKey, [{ id: 'a-device' }]);
  const view = render(
    <QueryClientProvider client={client}>
      <Watcher />
    </QueryClientProvider>,
  );
  return { client, view };
}

afterEach(() => {
  clearSession();
});

describe('useClearCacheOnSignOut', () => {
  it('empties the cache when the session ends', () => {
    const { client } = setup();
    act(() => {
      acceptSession(sessionResponse());
    });
    expect(client.getQueryData(sessionsListKey)).toBeDefined();

    act(() => {
      clearSession();
    });

    expect(client.getQueryData(sessionsListKey)).toBeUndefined();
  });

  it('empties the cache when another person takes over the session', () => {
    const { client } = setup();
    act(() => {
      acceptSession(sessionResponse());
    });
    client.setQueryData(sessionsListKey, [{ id: 'a-device' }]);

    act(() => {
      acceptSession(sessionResponse({ user: { ...sessionResponse().user, id: 'another-person' } }));
    });

    expect(client.getQueryData(sessionsListKey)).toBeUndefined();
  });

  it('keeps the cache while the same person stays signed in (a refresh)', () => {
    const { client } = setup();
    act(() => {
      acceptSession(sessionResponse());
    });

    act(() => {
      acceptSession(sessionResponse());
    });

    expect(client.getQueryData(sessionsListKey)).toBeDefined();
  });

  it('stops listening when the component unmounts', () => {
    const { client, view } = setup();
    act(() => {
      acceptSession(sessionResponse());
    });
    view.unmount();

    act(() => {
      clearSession();
    });

    expect(client.getQueryData(sessionsListKey)).toBeDefined();
  });
});
