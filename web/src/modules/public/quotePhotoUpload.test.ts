// The one photo retry (INQ-02, D-03, review W5 IN-02): after a busy answer (429 or 5xx) it waits a short time first, so the busy
// moment can pass; any other failure is retried at once or not at all.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { answerPhotos, pngFile, type PhotoAnswer } from '@/test/quotePhotoFixtures';
import { uploadPhotos, RETRY_WAIT_MS } from './quotePhotoUpload';

function upload(answers: Record<number, readonly PhotoAnswer[]>) {
  const calls = answerPhotos(answers);
  const done = uploadPhotos({
    requestId: 'request-1',
    slots: [0],
    photos: [pngFile('logo.png')],
    names: ['logo.png'],
    uploadKey: 'upload-key',
  });
  return { calls, done };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('uploadPhotos retry wait', () => {
  it('waits two seconds', () => {
    expect(RETRY_WAIT_MS).toBe(2000);
  });

  it.each([429, 500, 503])('waits before it retries after a %i, then the photo arrives', async (status) => {
    const { calls, done } = upload({ 0: [status, 200] });

    await vi.advanceTimersByTimeAsync(RETRY_WAIT_MS - 10);
    expect(calls).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(20);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.key).toBe(calls[0]?.key);
    await expect(done).resolves.toEqual([]);
  });

  it.each<PhotoAnswer>(['network', 408, 409])('retries at once after %j', async (answer) => {
    const { calls, done } = upload({ 0: [answer, 200] });

    await vi.advanceTimersByTimeAsync(0);

    expect(calls).toHaveLength(2);
    await expect(done).resolves.toEqual([]);
  });

  it('names the photo as missing when the retry after the wait fails too', async () => {
    const { calls, done } = upload({ 0: [503, 503] });

    await vi.advanceTimersByTimeAsync(RETRY_WAIT_MS + 10);

    expect(calls).toHaveLength(2);
    await expect(done).resolves.toEqual(['logo.png']);
  });

  it('never retries a refusal', async () => {
    const { calls, done } = upload({ 0: [422] });

    await vi.advanceTimersByTimeAsync(RETRY_WAIT_MS + 10);

    expect(calls).toHaveLength(1);
    await expect(done).resolves.toEqual(['logo.png']);
  });
});
