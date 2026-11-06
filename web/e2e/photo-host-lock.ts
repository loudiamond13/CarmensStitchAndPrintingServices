// A lock for the photo uploads of the E2E host (plan 09-16). The Testing switch POST /api/testing/images/fail-next is shared by the
// whole host, and the Playwright projects run side by side, so a failure armed by one test could be used up by another test's
// upload. Tests that upload photos run that part under this lock, one at a time, across all projects and workers.
// The lock is a directory (creating it is atomic) holding a token file. The holder touches the directory while it works, so a
// slow test is never taken over; a lock nobody touched for a few minutes was left by a crashed run and is taken over by
// renaming it away (atomic, so one waiter wins) and checked again once moved. A holder removes the lock only if the token in
// it is still its own.
import { mkdirSync, readFileSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOKEN_FILE = 'owner';

export interface PhotoHostLockOptions {
  readonly directory: string;
  readonly pollMs: number;
  readonly waitLimitMs: number;
  readonly staleAfterMs: number;
  readonly heartbeatMs: number;
}

const DEFAULTS: PhotoHostLockOptions = {
  directory: path.join(fileURLToPath(new URL('..', import.meta.url)), '.locks', 'photo-host.lock'),
  pollMs: 250,
  waitLimitMs: 4 * 60 * 1000,
  staleAfterMs: 3 * 60 * 1000,
  heartbeatMs: 30 * 1000,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function codeOf(error: unknown): string | undefined {
  return error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : undefined;
}

function tokenIn(directory: string): string | undefined {
  try {
    return readFileSync(path.join(directory, TOKEN_FILE), 'utf8');
  } catch {
    return undefined;
  }
}

function isStaleAt(directory: string, staleAfterMs: number): boolean {
  try {
    return Date.now() - statSync(directory).mtimeMs > staleAfterMs;
  } catch {
    return false;
  }
}

/**
 * Moves a stale lock out of the way. Only the waiter whose rename succeeds clears it. The moved lock is checked again, so a
 * fresh lock a new holder made after the stale check is put back, never deleted.
 */
export function takeOverStale(directory: string, staleAfterMs: number): void {
  const away = `${directory}.stale-${randomUUID()}`;
  try {
    renameSync(directory, away);
  } catch {
    return;
  }
  if (isStaleAt(away, staleAfterMs)) {
    rmSync(away, { recursive: true, force: true });
    return;
  }
  try {
    renameSync(away, directory);
  } catch {
    // Someone made a new lock meanwhile. Leave the moved one alone: it may still be in use, and its holder checks its token.
  }
}

export function createPhotoHostLock(options: PhotoHostLockOptions = DEFAULTS) {
  const { directory, pollMs, waitLimitMs, staleAfterMs, heartbeatMs } = options;

  async function acquire(token: string): Promise<void> {
    const deadline = Date.now() + waitLimitMs;
    for (;;) {
      try {
        mkdirSync(path.dirname(directory), { recursive: true });
        mkdirSync(directory);
        writeFileSync(path.join(directory, TOKEN_FILE), token);
        return;
      } catch (error) {
        if (codeOf(error) !== 'EEXIST') throw error;
        if (isStaleAt(directory, staleAfterMs)) {
          takeOverStale(directory, staleAfterMs);
          continue;
        }
        if (Date.now() > deadline) throw new Error('The photo host lock was not free in time.', { cause: error });
        await sleep(pollMs);
      }
    }
  }

  /** Runs `work` while no other test uploads photos to the E2E host. */
  async function withLock<T>(work: () => Promise<T>): Promise<T> {
    const token = randomUUID();
    await acquire(token);
    const heartbeat = setInterval(() => {
      if (tokenIn(directory) !== token) return;
      try {
        const now = new Date();
        utimesSync(directory, now, now);
      } catch {
        // The lock is gone; the release below checks the token again.
      }
    }, heartbeatMs);
    heartbeat.unref();
    try {
      return await work();
    } finally {
      clearInterval(heartbeat);
      if (tokenIn(directory) === token) {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  }

  return { withLock };
}

const shared = createPhotoHostLock();

/** Runs `work` while no other test uploads photos to the E2E host. */
export function withPhotoHost<T>(work: () => Promise<T>): Promise<T> {
  return shared.withLock(work);
}
