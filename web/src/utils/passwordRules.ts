// Mirrors the Domain PasswordPolicy (D-11) so a form can check every rule before sending; the server decides.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;

export type PasswordRuleFailure =
  'empty' | 'too-short' | 'too-long' | 'control-character' | 'no-number' | 'no-symbol' | 'contains-personal-info';

/** Code points of the NFC form, so an emoji is 1 and a composed and a decomposed e-acute are equal. */
export function passwordLength(password: string): number {
  return Array.from(password.normalize('NFC')).length;
}

/** Length, control-character, number and symbol rules only, in the Domain's fixed order. */
export function checkPasswordComposition(password: string): PasswordRuleFailure | null {
  const normalized = password.normalize('NFC');
  const length = Array.from(normalized).length;
  if (length === 0) return 'empty';
  if (length < PASSWORD_MIN_LENGTH) return 'too-short';
  if (length > PASSWORD_MAX_LENGTH) return 'too-long';
  if (/\p{Cc}/u.test(normalized)) return 'control-character';
  if (!/\p{Nd}/u.test(normalized)) return 'no-number';
  if (!/[\p{P}\p{S}]/u.test(normalized)) return 'no-symbol';
  return null;
}

export interface PersonalInfo {
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export const PASSWORD_RULE_MESSAGES: Readonly<Record<PasswordRuleFailure, string>> = {
  empty: 'Enter a new password.',
  'too-short': 'Use at least 8 characters.',
  'too-long': 'Use 64 characters or fewer.',
  'control-character': 'Remove tabs and line breaks from your password.',
  'no-number': 'Add at least one number.',
  'no-symbol': 'Add at least one symbol, like ! or #.',
  'contains-personal-info': "Don't use your name or email in your password.",
};

const PERSONAL_INFO_MIN_PART_LENGTH = 3;

/**
 * Composition rules, then the D-15 rule: no email local part, first name or last name inside the password, ignoring
 * case and parts under 3 characters. Upper-casing uses full case mapping, which differs from the server's simple
 * mapping for a few letters such as the German sharp s; the server decides.
 */
export function checkPassword(password: string, personal: PersonalInfo): PasswordRuleFailure | null {
  const failure = checkPasswordComposition(password);
  if (failure) return failure;
  const upper = password.normalize('NFC').toUpperCase();
  const email = personal.email;
  const at = email.lastIndexOf('@');
  const parts = [at >= 0 ? email.slice(0, at) : email, personal.firstName, personal.lastName];
  for (const raw of parts) {
    const part = (raw ?? '').normalize('NFC').trim();
    if (passwordLength(part) >= PERSONAL_INFO_MIN_PART_LENGTH && upper.includes(part.toUpperCase())) {
      return 'contains-personal-info';
    }
  }
  return null;
}
