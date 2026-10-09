// SPEC-GAP: SkipLink (RED stub, plan 02-27 Task 2).
import { ENTRY_COPY } from './copy';

export interface SkipLinkProps {
  targetId?: string;
}

export function SkipLink({ targetId = 'main' }: SkipLinkProps) {
  return <a href={`#${targetId}`}>{ENTRY_COPY.skipLink.label}</a>;
}
