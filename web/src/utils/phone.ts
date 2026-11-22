// The Philippine phone rule the public and admin forms share (OR-3): it mirrors the server's PhilippinePhone.TryParse, and the
// accept and refuse cases are the file the .NET tests read too (tests/fixtures/philippine-phone-cases.json). No regular
// expression that can backtrack (CWE-1333).

/** The longest text a person may type for a number, counted as typed (PhilippinePhone.MaxInputLength). */
export const PHONE_INPUT_MAX = 32;

/** The number as `+63` and digits, or null when it is not a Philippine mobile or landline number (PhilippinePhone.TryParse). */
export function phoneE164(text: string): string | null {
  if (text.length > PHONE_INPUT_MAX) {
    return null;
  }
  let digits = '';
  let international = false;
  for (const character of text) {
    if (/\s/u.test(character) || character === '-' || character === '.' || character === '(' || character === ')') {
      continue;
    }
    if (character === '+' && digits.length === 0 && !international) {
      international = true;
      continue;
    }
    if (character < '0' || character > '9') {
      return null;
    }
    digits += character;
  }
  let national: string;
  if (international) {
    if (!digits.startsWith('63')) {
      return null;
    }
    national = `0${digits.slice(2)}`;
  } else {
    if (!digits.startsWith('0')) {
      return null;
    }
    national = digits;
  }
  // Mobile: 11 digits starting 09. Landline: 10 digits starting 0 and then 1 to 8.
  const second = national[1] ?? '';
  const shaped =
    (national.length === 11 && second === '9') || (national.length === 10 && second >= '1' && second <= '8');
  return shaped ? `+63${national.slice(1)}` : null;
}

/** True for a normalized mobile number: `+639` and nine more digits, 13 characters. */
export function isMobileE164(e164: string): boolean {
  if (e164.length !== 13 || !e164.startsWith('+639')) return false;
  for (let index = 4; index < e164.length; index++) {
    const character = e164.charAt(index);
    if (character < '0' || character > '9') return false;
  }
  return true;
}
