// The query cache never outlives the person who filled it (shared workstation, WR-14, CWE-200).
import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';
import { setCacheOwner, trackQueryClient } from './cacheOwner';
import { sessionsListKey } from './keys';

function seeded(): QueryClient {
  const client = new QueryClient();
  client.setQueryData(sessionsListKey, [{ id: 'a-device' }]);
  return client;
}

const untrack: (() => void)[] = [];

function track(client: QueryClient): void {
  untrack.push(trackQueryClient(client));
}

afterEach(() => {
  setCacheOwner(null);
  for (const stop of untrack.splice(0)) {
    stop();
  }
});

describe('setCacheOwner', () => {
  it('clears every tracked client when the owner ends', () => {
    const first = seeded();
    const second = seeded();
    track(first);
    track(second);
    setCacheOwner('person-a');

    setCacheOwner(null);

    expect(first.getQueryData(sessionsListKey)).toBeUndefined();
    expect(second.getQueryData(sessionsListKey)).toBeUndefined();
  });

  it('clears when another person takes over', () => {
    const client = seeded();
    track(client);
    setCacheOwner('person-a');
    client.setQueryData(sessionsListKey, [{ id: 'a-device' }]);

    setCacheOwner('person-b');

    expect(client.getQueryData(sessionsListKey)).toBeUndefined();
  });

  it('keeps the cache for the same person (a refresh)', () => {
    const client = seeded();
    track(client);
    setCacheOwner('person-a');
    client.setQueryData(sessionsListKey, [{ id: 'a-device' }]);

    setCacheOwner('person-a');

    expect(client.getQueryData(sessionsListKey)).toBeDefined();
  });

  it('keeps the cache when the first person signs in', () => {
    const client = seeded();
    track(client);

    setCacheOwner('person-a');

    expect(client.getQueryData(sessionsListKey)).toBeDefined();
  });

  it('no longer clears a client once it is untracked', () => {
    const client = seeded();
    const stop = trackQueryClient(client);
    setCacheOwner('person-a');
    stop();

    setCacheOwner(null);

    expect(client.getQueryData(sessionsListKey)).toBeDefined();
  });
});
