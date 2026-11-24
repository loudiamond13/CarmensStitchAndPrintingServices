// The Add Note rule (D-17, OR-3): the browser checks AddQuoteRequestNoteRequestValidator.cs before sending, in the server's words.
import { z } from 'zod';
import { QUOTE_REQUEST_COPY } from '@/modules/admin/quoteRequestsCopy';

// The strict CSP has no 'unsafe-eval': every schema runs in its plain (non-generated) mode (see profileSchemas.ts).
z.config({ jitless: true });

const COPY = QUOTE_REQUEST_COPY.notes.errors;

/** QuoteRequestRules.NoteMaxLength. */
export const NOTE_MAX_LENGTH = 1000;

/** 1 to 1,000 characters after trimming; hands on the trimmed text. */
export const noteSchema = z.object({
  text: z.string().trim().min(1, COPY.required).max(NOTE_MAX_LENGTH, COPY.tooLong),
});

export type NoteInput = z.input<typeof noteSchema>;
export type NoteValues = z.output<typeof noteSchema>;
