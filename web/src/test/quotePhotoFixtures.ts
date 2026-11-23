// Photo files and the photo upload route for the quote form tests (INQ-02): a real PNG signature, so the picker reads the type
// from the first bytes.
import { http, HttpResponse } from 'msw';
import { server } from './msw';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** A small PNG-looking file. Two sizes give two different files, so a test can tell them apart. */
export function pngFile(name: string, size = 64): File {
  const bytes = new Uint8Array(size);
  bytes.set(PNG_SIGNATURE);
  bytes[PNG_SIGNATURE.length] = size % 251;
  return new File([bytes], name, { type: 'image/png' });
}

/** One answer of the photo route: a status, or 'network' for a dropped connection. */
export type PhotoAnswer = number | 'network';

export interface PhotoCall {
  readonly slot: number;
  readonly key: string | null;
  readonly uploadKey: string | null;
}

/**
 * Answers `POST /public/quote-requests/{id}/photos/{slot}`: each slot takes its answers in turn, the last one repeating; a slot not
 * listed answers 200 with no body. The calls are recorded in order.
 */
export function answerPhotos(answers: Record<number, readonly PhotoAnswer[]> = {}): PhotoCall[] {
  const calls: PhotoCall[] = [];
  server.use(
    http.post('*/api/v1/public/quote-requests/:id/photos/:slot', ({ request, params }) => {
      const slot = Number(params['slot']);
      const sent = calls.filter((call) => call.slot === slot).length;
      calls.push({ slot, key: request.headers.get('Idempotency-Key'), uploadKey: request.headers.get('X-Upload-Key') });
      const list = answers[slot] ?? [200];
      const answer = list[Math.min(sent, list.length - 1)] ?? 200;
      if (answer === 'network') {
        return HttpResponse.error();
      }
      if (answer === 200) {
        return new HttpResponse(null, { status: 200 });
      }
      return HttpResponse.json(
        { title: 'Something went wrong.', status: answer, code: answer === 422 ? 'quote-requests.photo-refused' : undefined },
        { status: answer, headers: { 'Content-Type': 'application/problem+json' } },
      );
    }),
  );
  return calls;
}
