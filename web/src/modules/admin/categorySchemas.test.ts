import { describe, expect, it } from 'vitest';
import { categoryFormSchema } from './categorySchemas';

// The category form (OR-3, D-08, D-13, OQ-10; plan 06-17): every rule the server validates, with the server's own words. Uniqueness and
// the Others rename refusal are the server's alone.

const NAME_REQUIRED = 'Enter a category name.';
const NAME_TOO_LONG = 'Keep the name to 40 characters or fewer.';
const TONE_REQUIRED = 'Choose a badge color.';

function messages(input: { name: string; tone: string }): Record<string, string> {
  const result = categoryFormSchema.safeParse(input);
  const found: Record<string, string> = {};
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = String(issue.path[0]);
      found[field] ??= issue.message;
    }
  }
  return found;
}

describe('categoryFormSchema', () => {
  it('accepts a name and each of the six tones', () => {
    for (const tone of ['neutral', 'accent', 'info', 'mockup', 'warning', 'success']) {
      expect(categoryFormSchema.safeParse({ name: 'Packaging', tone }).success).toBe(true);
    }
  });

  it('trims the name', () => {
    expect(categoryFormSchema.parse({ name: '  Packaging  ', tone: 'info' })).toEqual({
      name: 'Packaging',
      tone: 'info',
    });
  });

  it('asks for a name when it is empty or only spaces', () => {
    expect(messages({ name: '', tone: 'info' })).toEqual({ name: NAME_REQUIRED });
    expect(messages({ name: '   ', tone: 'info' })).toEqual({ name: NAME_REQUIRED });
  });

  it('allows 40 characters and refuses 41, counted after the trim', () => {
    expect(messages({ name: 'a'.repeat(40), tone: 'info' })).toEqual({});
    expect(messages({ name: `  ${'a'.repeat(40)}  `, tone: 'info' })).toEqual({});
    expect(messages({ name: 'a'.repeat(41), tone: 'info' })).toEqual({ name: NAME_TOO_LONG });
  });

  it('asks for a badge color when the tone is none of the six', () => {
    expect(messages({ name: 'Packaging', tone: '' })).toEqual({ tone: TONE_REQUIRED });
    expect(messages({ name: 'Packaging', tone: 'danger' })).toEqual({ tone: TONE_REQUIRED });
    expect(messages({ name: 'Packaging', tone: 'solid' })).toEqual({ tone: TONE_REQUIRED });
  });

  it('reports the name and the tone together', () => {
    expect(messages({ name: '', tone: 'red' })).toEqual({ name: NAME_REQUIRED, tone: TONE_REQUIRED });
  });
});
