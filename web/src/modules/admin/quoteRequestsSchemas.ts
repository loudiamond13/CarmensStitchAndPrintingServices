// The Add Note rule (D-17, OR-3): the browser checks AddQuoteRequestNoteRequestValidator.cs before sending, in the server's words.
import { z } from 'zod';
import { QUOTE_REQUEST_COPY } from '@/modules/admin/quoteRequestsCopy';

// The strict CSP has no 'unsafe-eval': every schema runs in its plain (non-generated) mode (see profileSchemas.ts).
z.config({ jitless: true });

const COPY = QUOTE_REQUEST_COPY.notes.errors;

/** QuoteRequestRules.NoteMaxLength. */
export const NOTE_MAX_LENGTH = 1000;

/** What .NET string.Trim() trims (char.IsWhiteSpace). JavaScript's trim keeps U+0085 and trims U+FEFF, so the list is spelled out. */
const DOTNET_SPACE = '[\\t\\n\\v\\f\\r \\u0085\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000]';
const DOTNET_TRIM = new RegExp(`^${DOTNET_SPACE}+|${DOTNET_SPACE}+$`, 'g');

/** 1 to 1,000 characters after trimming as the server does; hands on the trimmed text. */
export const noteSchema = z.object({
  text: z
    .string()
    .overwrite((text) => text.replace(DOTNET_TRIM, ''))
    .min(1, COPY.required)
    .max(NOTE_MAX_LENGTH, COPY.tooLong),
});

export type NoteInput = z.input<typeof noteSchema>;
export type NoteValues = z.output<typeof noteSchema>;
