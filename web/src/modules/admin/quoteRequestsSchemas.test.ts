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
