// A lock for the shared public site content of the E2E host (plan 11-10). The singleton site settings and the phone list are
// one set for all five Playwright projects, so a spec that resets them (seedDemoSiteContent) or changes them must not run
// beside another that reads them. Specs that read or change that content run under this lock, one at a time, across all
// projects and workers. It is the photo host lock with its own lock directory, so the two never wait on each other.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPhotoHostLock } from './photo-host-lock.ts';

const shared = createPhotoHostLock({
  directory: path.join(fileURLToPath(new URL('..', import.meta.url)), '.locks', 'site-content.lock'),
  pollMs: 250,
  // Specs that take this lock allow 8 minutes, and a sweep holds it for minutes, so a waiter gets 7 minutes.
  waitLimitMs: 7 * 60 * 1000,
  staleAfterMs: 3 * 60 * 1000,
  heartbeatMs: 30 * 1000,
  name: 'site content',
});

/** Runs `work` while no other test reads or changes the shared public site content. */
export function withSiteContentLock<T>(work: () => Promise<T>): Promise<T> {
  return shared.withLock(work);
}
