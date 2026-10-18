// SPEC-GAP: RecordMeta (stub for the RED commit; plan 05-25).
export interface RecordMetaProps {
  recordedBy: { name: string; formerStaff: boolean } | null;
  recordedAt: string | null;
  lastChangedBy: { name: string; formerStaff: boolean } | null;
  lastChangedAt: string | null;
}

export function RecordMeta(_props: RecordMetaProps) {
  return null;
}
