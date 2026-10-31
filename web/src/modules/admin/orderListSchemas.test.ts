import { describe, expect, it } from 'vitest';
import { CATEGORY_TONES } from '@/components/status';
import { ORDER_LIST_NAME_MAX, orderListEntrySchema } from './orderListSchemas';

// The order list entry form checks what the server checks, with the server's own words (OR-3; 07 D-19, D-40).

const REQUIRED = 'Enter a product type name.';

function messages(input: unknown): Record<string, string> {
  const result = orderListEntrySchema(REQUIRED).safeParse(input);
  if (result.success) {
    return {};
  }
  return Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0]), issue.message]));
}

describe('orderListEntrySchema', () => {
  it('allows a name of 40 characters', () => {
    expect(ORDER_LIST_NAME_MAX).toBe(40);
    expect(messages({ name: 'x'.repeat(40), tone: 'info' })).toEqual({});
  });

  it('counts the length after the trim', () => {
    expect(messages({ name: `  ${'x'.repeat(40)}  `, tone: 'info' })).toEqual({});
  });

  it('hands back the trimmed name', () => {
    const result = orderListEntrySchema(REQUIRED).parse({ name: '  Hoodie  ', tone: 'info' });
    expect(result).toEqual({ name: 'Hoodie', tone: 'info' });
  });

  it.each(['', '   '])('asks for a name when it is %j, with the list noun', (name) => {
    expect(messages({ name, tone: 'info' })).toEqual({ name: REQUIRED });
  });

  it('uses the required message it was built with', () => {
    const result = orderListEntrySchema('Enter a category name.').safeParse({ name: '', tone: 'info' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Enter a category name.');
  });

  it('refuses a name over 40 characters with the server message', () => {
    expect(messages({ name: 'x'.repeat(41), tone: 'info' })).toEqual({
      name: 'Keep the name to 40 characters or fewer.',
    });
  });

  it.each(CATEGORY_TONES)('accepts the tone %s', (tone) => {
    expect(messages({ name: 'Hoodie', tone })).toEqual({});
  });

  it.each(['', 'purple', 'Accent'])('refuses the tone %j with "Choose a badge color."', (tone) => {
    expect(messages({ name: 'Hoodie', tone })).toEqual({ tone: 'Choose a badge color.' });
  });
});
