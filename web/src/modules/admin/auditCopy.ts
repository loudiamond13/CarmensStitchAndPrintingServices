// RED stub (plan 05-33): replaced in the GREEN commit.
export const AUDIT_GROUPS: readonly string[] = [];
export const AUDIT_ACTIONS: readonly { code: string; label: string; group: string }[] = [];
export const AUDIT_ACTION_CODES: readonly string[] = [];

export function auditActionLabel(code: string): string {
  return code === '' ? code : '';
}

export function describeAuditDetail(action: string, detail: string | null): string | null {
  return action === '' || detail === null ? null : 'stub';
}
