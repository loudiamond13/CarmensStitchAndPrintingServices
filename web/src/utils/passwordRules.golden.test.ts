// @vitest-environment node
// D-11 golden cases: the browser mirror must give the verdict of every case in the shared file that the xUnit suite
// (Csps.Domain.UnitTests PasswordPolicyTests) also checks. The file is only read here.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkPasswordComposition, passwordLength, type PasswordRuleFailure } from './passwordRules';

interface PasswordCase {
  id: string;
  note: string;
  password: string;
  personal: { email: string; firstName: string | null; lastName: string | null } | null;
  mode: 'composition' | 'full';
  expected: 'ok' | PasswordRuleFailure;
}

interface CaseFile {
  version: number;
  kind: string;
  messages: Record<PasswordRuleFailure, string>;
  cases: PasswordCase[];
}

const shared = JSON.parse(
  readFileSync(new URL('../../../tests/fixtures/password-policy-cases.json', import.meta.url), 'utf8'),
) as CaseFile;

const compositionCases = shared.cases.filter((c) => c.mode === 'composition');

describe('password policy golden cases', () => {
  it('pins the shared file kind and version', () => {
    expect(shared.version).toBe(1);
    expect(shared.kind).toBe('csps-password-policy-cases');
    expect(new Set(shared.cases.map((c) => c.id)).size).toBe(shared.cases.length);
  });

  it('has at least 14 composition cases', () => {
    expect(compositionCases.length).toBeGreaterThanOrEqual(14);
  });

  it.for(compositionCases)('composition $id: $note', (c) => {
    expect(checkPasswordComposition(c.password)).toBe(c.expected === 'ok' ? null : c.expected);
  });

  it('counts an emoji as one and a composed and a decomposed e-acute alike', () => {
    expect(passwordLength('\u{1F600}')).toBe(1);
    expect(passwordLength('\u{1F600}\u{1F600}a')).toBe(3);
    expect(passwordLength('café')).toBe(4);
    expect(passwordLength('café')).toBe(4);
  });
});
