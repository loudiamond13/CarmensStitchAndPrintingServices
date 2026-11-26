import { describe, expect, it } from 'vitest';
import { noteSchema } from './quoteRequestsSchemas';

// The Add Note rule (D-17, OR-3): the server's AddQuoteRequestNoteRequestValidator, 1 to 1,000 characters after trimming.

function messages(text: string): string[] {
  const result = noteSchema.safeParse({ text });
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe('noteSchema', () => {
  it('asks for a note when the box is empty', () => {
    expect(messages('')).toEqual(['Write a note first.']);
  });

  it('asks for a note when the box holds only spaces and line breaks', () => {
    expect(messages('   \n\t  ')).toEqual(['Write a note first.']);
  });

  it('refuses 1,001 characters', () => {
    expect(messages('a'.repeat(1001))).toEqual(['Keep the note to 1,000 characters or fewer.']);
  });

  it('accepts 1,000 characters', () => {
    expect(messages('a'.repeat(1000))).toEqual([]);
  });

  it('counts after trimming and hands on the trimmed text, line breaks inside kept', () => {
    const result = noteSchema.safeParse({ text: `  ${'a'.repeat(998)}\nb  \n` });
    expect(result.success).toBe(true);
    expect(result.data?.text).toBe(`${'a'.repeat(998)}\nb`);
  });
});

// The server trims with .NET string.Trim(): it trims U+0085 (JavaScript keeps it) and keeps U+FEFF (JavaScript trims it).
describe('noteSchema trims as .NET does (13-REVIEW-W9 IN-04)', () => {
  const DOTNET_WHITE_SPACE = [
    0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20, 0x85, 0xa0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006,
    0x2007, 0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000,
  ].map((code) => String.fromCharCode(code));

  it('asks for a note when the box holds only U+0085', () => {
    expect(messages('\u0085')).toEqual(['Write a note first.']);
  });

  it('accepts a note of only U+FEFF and hands it on, as the server keeps it', () => {
    expect(noteSchema.parse({ text: '\uFEFF' }).text).toBe('\uFEFF');
  });

  it('trims every character .NET trims at either end', () => {
    for (const space of DOTNET_WHITE_SPACE) {
      expect(noteSchema.parse({ text: `${space}a${space}` }).text).toBe('a');
    }
  });

  it('trims U+0085 and keeps U+FEFF, then counts what is left', () => {
    expect(noteSchema.parse({ text: '\u0085\uFEFF Call back \uFEFF\u0085' }).text).toBe('\uFEFF Call back \uFEFF');
    expect(messages(`\u0085${'a'.repeat(1000)}\u0085`)).toEqual([]);
    expect(messages(`\uFEFF${'a'.repeat(1000)}`)).toEqual(['Keep the note to 1,000 characters or fewer.']);
  });
});
