// Mirrors the Domain PasswordPolicy (D-11) so a form can check every rule before sending; the server decides.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;

export type PasswordRuleFailure =
  | 'empty'
  | 'too-short'
  | 'too-long'
  | 'control-character'
  | 'no-number'
  | 'no-symbol'
  | 'contains-personal-info';

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
