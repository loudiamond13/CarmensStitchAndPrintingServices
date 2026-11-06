// @vitest-environment node
// Pins the photo host lock of the E2E specs (WR-G4-03): one holder at a time, a held lock is kept fresh so a slow test is
// never taken over, a stale lock left by a dead run is taken over by exactly one waiter, and a holder only ever deletes
// its own lock.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPhotoHostLock, takeOverStale } from '../e2e/photo-host-lock.ts';

const TOKEN_FILE = 'owner';

let root = '';
let directory = '';

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), 'csps-photo-lock-'));
  directory = path.join(root, 'photo-host.lock');
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function fast(overrides: { staleAfterMs?: number; heartbeatMs?: number; waitLimitMs?: number } = {}) {
  return createPhotoHostLock({
    directory,
    pollMs: 10,
    waitLimitMs: 5000,
    staleAfterMs: 300,
    heartbeatMs: 50,
    ...overrides,
  });
}

/** Leaves a lock behind as a crashed run would: a directory with someone's token, last touched `ageMs` ago. */
function leaveLock(token: string, ageMs: number): void {
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, TOKEN_FILE), token);
  const when = new Date(Date.now() - ageMs);
  utimesSync(directory, when, when);
}

describe('createPhotoHostLock', () => {
  it('lets one holder in at a time', async () => {
    const lock = fast();
    let inside = 0;
    let overlaps = 0;
    const work = async () => {
      inside += 1;
      overlaps += inside > 1 ? 1 : 0;
      await sleep(40);
      inside -= 1;
    };

    await Promise.all([lock.withLock(work), lock.withLock(work), lock.withLock(work)]);

    expect(overlaps).toBe(0);
    expect(existsSync(directory)).toBe(false);
  });

  it('keeps a held lock fresh, so a holder slower than the stale limit is not taken over', async () => {
    const lock = fast({ staleAfterMs: 200, heartbeatMs: 40 });
    let inside = 0;
    let overlaps = 0;

    await Promise.all([
      lock.withLock(async () => {
        inside += 1;
        await sleep(700);
        inside -= 1;
      }),
      (async () => {
        await sleep(60);
        await lock.withLock(async () => {
          inside += 1;
          overlaps += inside > 1 ? 1 : 0;
          inside -= 1;
          await Promise.resolve();
        });
      })(),
    ]);

    expect(overlaps).toBe(0);
  });

  it('takes over a stale lock left by a dead run', async () => {
    leaveLock('dead-run', 10_000);
    const lock = fast();
    let ran = false;

    await lock.withLock(() => {
      ran = true;
      return Promise.resolve();
    });

    expect(ran).toBe(true);
    expect(existsSync(directory)).toBe(false);
  });

  it('lets only one of two waiters take over the same stale lock', async () => {
    leaveLock('dead-run', 10_000);
    const lock = fast();
    let inside = 0;
    let overlaps = 0;
    const work = async () => {
      inside += 1;
      overlaps += inside > 1 ? 1 : 0;
      await sleep(80);
      inside -= 1;
    };

    await Promise.all([lock.withLock(work), lock.withLock(work)]);

    expect(overlaps).toBe(0);
  });

  it('never deletes a lock that now belongs to someone else', async () => {
    const lock = fast();

    await lock.withLock(() => {
      // Another run took the lock over while this holder was still working.
      rmSync(directory, { recursive: true, force: true });
      leaveLock('someone-else', 0);
      return Promise.resolve();
    });

    expect(readFileSync(path.join(directory, TOKEN_FILE), 'utf8')).toBe('someone-else');
  });

  it('gives up with a clear error when the lock is never free', async () => {
    leaveLock('busy-run', 0);
    const lock = fast({ staleAfterMs: 60_000, waitLimitMs: 100 });

    await expect(lock.withLock(() => Promise.resolve())).rejects.toThrow('The photo host lock was not free in time.');
  });

  it('releases the lock when the work throws', async () => {
    const lock = fast();

    await expect(lock.withLock(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');

    expect(existsSync(directory)).toBe(false);
  });
});

describe('takeOverStale', () => {
  it('puts back a lock that a new holder took after the stale check, instead of deleting it', () => {
    // The waiter saw a stale lock, but by the time it moves the lock, a new holder has made a fresh one.
    leaveLock('new-holder', 0);

    takeOverStale(directory, 300);

    expect(readFileSync(path.join(directory, TOKEN_FILE), 'utf8')).toBe('new-holder');
  });

  it('removes a lock that is still stale once moved', () => {
    leaveLock('dead-run', 10_000);

    takeOverStale(directory, 300);

    expect(existsSync(directory)).toBe(false);
  });
});
