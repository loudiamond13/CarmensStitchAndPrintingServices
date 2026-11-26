// Photo files and photo upload answers for the quote form tests (INQ-02): a real PNG signature, so the picker reads the type from
// the first bytes. Uploads are answered at the service, because the test runner's fetch cannot send a jsdom File in a FormData.
import { vi } from 'vitest';
import { HttpError } from '@/core/api/errors';
import { quoteService } from '@/modules/public/services/quoteService';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** A small PNG-looking file. Two sizes give two different files, so a test can tell them apart. */
export function pngFile(name: string, size = 64): File {
  const bytes = new Uint8Array(size);
  bytes.set(PNG_SIGNATURE);
  bytes[PNG_SIGNATURE.length] = size % 251;
  return new File([bytes], name, { type: 'image/png' });
}

/** One answer of the photo upload: a status, or 'network' for a dropped connection. */
export type PhotoAnswer = number | 'network';

export interface PhotoCall {
  readonly slot: number;
  readonly key: string;
  readonly uploadKey: string;
}

function failure(answer: Exclude<PhotoAnswer, 200>): HttpError {
  if (answer === 'network') {
    return new HttpError({ kind: 'network' });
  }
  return new HttpError({
    kind: 'http',
    status: answer,
    problem: {
      type: undefined,
      title: 'Something went wrong.',
      status: answer,
      detail: undefined,
      instance: undefined,
      traceId: undefined,
      code: answer === 422 ? 'quote-requests.photo-refused' : undefined,
      errors: {},
    },
  });
}

/**
 * Answers `quoteService.uploadPhoto`: each slot takes its answers in turn, the last one repeating; a slot not listed succeeds. The
 * calls are recorded in order. `vi.restoreAllMocks` undoes it.
 */
export function answerPhotos(answers: Record<number, readonly PhotoAnswer[]> = {}): PhotoCall[] {
  const calls: PhotoCall[] = [];
  vi.spyOn(quoteService, 'uploadPhoto').mockImplementation((_id, slot, _file, _name, uploadKey, key) => {
    const sent = calls.filter((call) => call.slot === slot).length;
    calls.push({ slot, key, uploadKey });
    const list = answers[slot] ?? [200];
    const answer = list[Math.min(sent, list.length - 1)] ?? 200;
    return answer === 200 ? Promise.resolve() : Promise.reject(failure(answer));
  });
  return calls;
}
