// A lock for the photo uploads of the E2E host (plan 09-16). The Testing switch POST /api/testing/images/fail-next is shared by the
// whole host, and the Playwright projects run side by side, so a failure armed by one test could be used up by another test's
// upload. Tests that upload photos run that part under this lock, one at a time, across all projects and workers. The lock is a
// directory (creating it is atomic); one left behind by a crashed run is taken over after a few minutes.
import { mkdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LOCK_DIRECTORY = path.join(fileURLToPath(new URL('..', import.meta.url)), '.locks', 'photo-host.lock');
const POLL_MS = 250;
const WAIT_LIMIT_MS = 4 * 60 * 1000;
const STALE_AFTER_MS = 3 * 60 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isStale(): boolean {
  try {
    return Date.now() - statSync(LOCK_DIRECTORY).mtimeMs > STALE_AFTER_MS;
  } catch {
    return false;
  }
}

async function acquire(): Promise<void> {
  const deadline = Date.now() + WAIT_LIMIT_MS;
  for (;;) {
    try {
      mkdirSync(path.dirname(LOCK_DIRECTORY), { recursive: true });
      mkdirSync(LOCK_DIRECTORY);
      return;
    } catch (error) {
      const exists = error instanceof Error && 'code' in error && error.code === 'EEXIST';
      if (!exists) throw error;
      if (isStale()) {
        rmSync(LOCK_DIRECTORY, { recursive: true, force: true });
        continue;
      }
      if (Date.now() > deadline) throw new Error('The photo host lock was not free in time.', { cause: error });
      await sleep(POLL_MS);
    }
  }
}

/** Runs `work` while no other test uploads photos to the E2E host. */
export async function withPhotoHost<T>(work: () => Promise<T>): Promise<T> {
  await acquire();
  try {
    return await work();
  } finally {
    rmSync(LOCK_DIRECTORY, { recursive: true, force: true });
  }
}
