// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isMobileE164, phoneE164 } from '@/utils/phone';

// The Philippine phone rule the public form and the admin forms share. The accept and refuse cases are the file the .NET tests
// read too (tests/fixtures/philippine-phone-cases.json).

interface PhoneCases {
  accept: { input: string; e164: string; display: string }[];
  refuse: string[];
}

const phoneCases = JSON.parse(
  readFileSync(new URL('../../../tests/fixtures/philippine-phone-cases.json', import.meta.url), 'utf8'),
) as PhoneCases;

describe('phoneE164 (the shared phone cases)', () => {
  it.each(phoneCases.accept)('reads $input as $e164', ({ input, e164 }) => {
    expect(phoneE164(input)).toBe(e164);
  });

  it.each(phoneCases.refuse)('refuses the number %j', (input) => {
    expect(phoneE164(input)).toBeNull();
  });

  it('strips round brackets and nothing else: a number in square brackets is refused', () => {
    expect(phoneE164('(02) 8123 4567')).toBe('+63281234567');
    expect(phoneE164('[0917 000 0000]')).toBeNull();
  });
});

describe('isMobileE164 (a +639 number of 13 characters)', () => {
  it('is true for a mobile number', () => {
    expect(isMobileE164('+639171234567')).toBe(true);
    expect(isMobileE164(phoneE164('0917 123 4567') ?? '')).toBe(true);
  });

  it('is false for a landline', () => {
    expect(isMobileE164('+63281234567')).toBe(false);
    expect(isMobileE164(phoneE164('(02) 8123 4567') ?? '')).toBe(false);
  });

  it('is false for text that is not a normalized number', () => {
    expect(isMobileE164('')).toBe(false);
    expect(isMobileE164('09171234567')).toBe(false);
    expect(isMobileE164('+6391712345678')).toBe(false);
    expect(isMobileE164('+639171234567 ')).toBe(false);
  });
});
