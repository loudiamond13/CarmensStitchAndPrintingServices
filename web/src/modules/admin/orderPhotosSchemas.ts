// The photo pick rules (OR-3, IMG-02; plan 09-16): the browser checks every rule of the upload endpoint before a request is sent,
// with the server's own words. The numbers come from GET /orders/image-rules, never from this file.
import { z } from 'zod';
import { ORDER_PHOTOS_COPY } from '@/modules/admin/orderPhotosCopy';
import type { ImageRulesResponse } from '@/modules/admin/services/orderPhotosService';

// The strict CSP has no 'unsafe-eval': every schema runs in its plain (non-generated) mode (see profileSchemas.ts).
z.config({ jitless: true });

const REASONS = ORDER_PHOTOS_COPY.reasons;

/** The server's photo rules as plain numbers (the generated types allow a number or a numeric string). */
export interface ImageRules {
  maxPerOrder: number;
  maxBytes: number;
  maxPixels: number;
  maxSide: number;
  types: readonly string[];
  descriptionMaxLength: number;
}

export function toImageRules(response: ImageRulesResponse): ImageRules {
  return {
    maxPerOrder: Number(response.maxPerOrder),
    maxBytes: Number(response.maxBytes),
    maxPixels: Number(response.maxPixels),
    maxSide: Number(response.maxSide),
    types: response.types,
    descriptionMaxLength: Number(response.descriptionMaxLength),
  };
}

export type PickRefusal = 'type' | 'size' | 'pixels' | 'unreadable';

const FILE_NAME_LIMIT = 80;
const BYTES_PER_KB = 1024;
const BYTES_PER_MB = 1_048_576;
const PIXELS_PER_MEGAPIXEL = 1_000_000;

function isControl(character: string): boolean {
  const code = character.charCodeAt(0);
  return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
}

/** The name as the server cleans it for a message: no folders, no control characters, at most 80 characters. */
export function cleanFileName(name: string): string {
  const cut = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
  const leaf = cut >= 0 ? name.slice(cut + 1) : name;
  const cleaned = Array.from(leaf)
    .filter((character) => !isControl(character))
    .join('')
    .trim();
  const limited = cleaned.length > FILE_NAME_LIMIT ? cleaned.slice(0, FILE_NAME_LIMIT) : cleaned;
  return limited === '' ? 'This file' : limited;
}

/** The size limit in whole MB, or KB or bytes for a small configured limit, as the server writes it. */
export function sizeText(bytes: number): string {
  if (bytes >= BYTES_PER_MB) return `${String(Math.floor(bytes / BYTES_PER_MB))} MB`;
  if (bytes >= BYTES_PER_KB) return `${String(Math.floor(bytes / BYTES_PER_KB))} KB`;
  return `${String(bytes)} bytes`;
}

/** The message for a refused file, in the server's own words (IMG-02). */
export function pickFailureMessage(reason: PickRefusal, fileName: string, rules: ImageRules): string {
  const name = cleanFileName(fileName);
  switch (reason) {
    case 'type':
      return REASONS.type(name);
    case 'size':
      return REASONS.size(name, sizeText(rules.maxBytes));
    case 'pixels':
      return REASONS.pixels(name, Number((rules.maxPixels / PIXELS_PER_MEGAPIXEL).toFixed(1)));
    case 'unreadable':
      return REASONS.unreadable(name);
  }
}

/** What `prepareImage` made of a picked file: the facts the upload endpoint checks. */
export interface PickFacts {
  name: string;
  /** The MIME type of the prepared bytes, such as `image/jpeg`. */
  type: string;
  bytes: number;
  /** Null when the browser could not read the pixels (HEIC); the server checks them. */
  width: number | null;
  height: number | null;
}

function refusalOf(file: PickFacts, rules: ImageRules): PickRefusal | null {
  if (!rules.types.includes(file.type.replace(/^image\//, ''))) return 'type';
  if (file.bytes > rules.maxBytes) return 'size';
  if (file.width !== null && file.height !== null) {
    if (file.width * file.height > rules.maxPixels || Math.max(file.width, file.height) > rules.maxSide) {
      return 'pixels';
    }
  }
  return null;
}

/** The pick check: type, size and pixels of a prepared photo against the server's rules (OR-3). */
export function buildPickSchema(rules: ImageRules) {
  return z
    .object({
      name: z.string(),
      type: z.string(),
      bytes: z.number(),
      width: z.number().nullable(),
      height: z.number().nullable(),
    })
    .superRefine((file, context) => {
      const refusal = refusalOf(file, rules);
      if (refusal !== null) {
        context.addIssue({ code: 'custom', message: pickFailureMessage(refusal, file.name, rules) });
      }
    });
}

/** The first message of a failed pick check, or null when the photo passes. */
export function pickIssue(rules: ImageRules, facts: PickFacts): string | null {
  const verdict = buildPickSchema(rules).safeParse(facts);
  return verdict.success ? null : (verdict.error.issues[0]?.message ?? null);
}

/**
 * A description: trimmed, at most the server's limit (D-12). The length is the JavaScript string length (UTF-16 code units), not zod's
 * `max`, which counts code points: the server counts units, so an emoji must cost two here as well.
 */
export function descriptionSchema(rules: ImageRules) {
  return z
    .string()
    .trim()
    .refine(
      (text) => text.length <= rules.descriptionMaxLength,
      REASONS.descriptionTooLong(rules.descriptionMaxLength),
    );
}
