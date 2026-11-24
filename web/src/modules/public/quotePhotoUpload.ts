// Sends the photos of a saved quote request (INQ-02, D-03): one call per photo, at most two at a time. A photo that fails is a
// missing photo, never an error: the text is already saved. It loads with the picker, so the form's own piece stays small (D-43).
import { isHttpError } from '@/core/api/errors';
import { newIdempotencyKey } from '@/lib/forms/idempotencyKey';
import { cleanFileName } from '@/utils/images';
import { newUploadKey } from './quoteSchemas';
import { quoteService, type CreateQuoteAnswer, type CreateQuoteBody, type QuoteService } from './services/quoteService';

/** How many photos go up at the same time. */
const AT_ONCE = 2;

/** The wait before the one retry after a busy answer (429 or 5xx), so the busy moment can pass. */
export const RETRY_WAIT_MS = 2000;

/** The names the create call declares: the file names without folders or control characters. */
function photoNames(photos: readonly File[]): string[] {
  return photos.map((file) => cleanFileName(file.name));
}

/** A failure that a second try with the same key may fix: no answer, a busy server or a busy photo pool. A refusal is final. */
function worthRetrying(error: unknown): boolean {
  if (!isHttpError(error) || error.kind !== 'http') {
    return true;
  }
  return error.status === 408 || error.status === 409 || isBusy(error);
}

function isBusy(error: unknown): boolean {
  return isHttpError(error) && error.kind === 'http' && (error.status === 429 || error.status >= 500);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export interface PhotoUpload {
  readonly requestId: string;
  /** The place of each photo, in the order of `photos`, from the create answer. */
  readonly slots: readonly number[];
  readonly photos: readonly File[];
  /** The declared names, in the same order. */
  readonly names: readonly string[];
  readonly uploadKey: string;
  /** Where the photos go; the real service unless the caller gives one. */
  readonly service?: Pick<QuoteService, 'uploadPhoto'> | undefined;
}

/** Uploads every photo and answers the names of the ones that did not arrive, in the order picked. */
export async function uploadPhotos({
  requestId,
  slots,
  photos,
  names,
  uploadKey,
  service = quoteService,
}: PhotoUpload): Promise<string[]> {
  const missing = new Set<number>();
  let next = 0;

  const send = async (index: number, slot: number, idempotencyKey: string): Promise<void> => {
    const file = photos[index];
    if (file === undefined) {
      throw new Error('No photo at this place.');
    }
    await service.uploadPhoto(requestId, slot, file, names[index] ?? file.name, uploadKey, idempotencyKey);
  };

  const worker = async (): Promise<void> => {
    for (;;) {
      const index = next++;
      if (index >= photos.length) {
        return;
      }
      const slot = slots[index];
      if (slot === undefined) {
        missing.add(index);
        continue;
      }
      // One key per photo, kept for its one retry, so a photo that did arrive is not stored twice.
      const key = newIdempotencyKey();
      try {
        await send(index, slot, key);
      } catch (first: unknown) {
        try {
          if (!worthRetrying(first)) {
            throw first;
          }
          if (isBusy(first)) {
            await wait(RETRY_WAIT_MS);
          }
          await send(index, slot, key);
        } catch {
          missing.add(index);
        }
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(AT_ONCE, photos.length) }, worker));
  return names.filter((_, index) => missing.has(index));
}

/** The upload key belongs to one Idempotency-Key, so a retry declares the same key and the stored answer fits. */
export interface HeldUploadKey {
  readonly forKey: string;
  readonly uploadKey: string;
}

export interface PhotoSend {
  /** The Idempotency-Key of this send. */
  readonly key: string;
  readonly body: Omit<CreateQuoteBody, 'ticket'>;
  readonly photos: readonly File[];
  /** Where the upload key is kept in memory between a send and its retry (T-13-36). */
  readonly held: { current: HeldUploadKey | undefined };
  /** Creates the request: the form adds the ticket and answers an expired one. */
  readonly create: (body: Omit<CreateQuoteBody, 'ticket'>) => Promise<CreateQuoteAnswer>;
  /** Where the photos go; the real service unless the caller gives one. */
  readonly service?: Pick<QuoteService, 'uploadPhoto'> | undefined;
}

/** The text is saved first with the photo names and the upload key; each photo then goes to its own place (D-03). */
export async function sendWithPhotos({ key, body, photos, held, create, service }: PhotoSend): Promise<string[]> {
  const uploadKey = held.current?.forKey === key ? held.current.uploadKey : newUploadKey();
  held.current = { forKey: key, uploadKey };
  const names = photoNames(photos);
  const answer = await create({ ...body, photos: names, uploadKey });
  return uploadPhotos({
    requestId: answer.id,
    slots: answer.photoSlots.map((place) => Number(place.slot)),
    photos,
    names,
    uploadKey,
    service,
  });
}
