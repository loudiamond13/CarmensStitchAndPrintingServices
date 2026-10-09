// Reference side of the dev-only failed-confirm wrapper (plan 02-22; test only, never shipped). The frozen App. D.3
// ConfirmDialog has no failure state, so this case is implementation only (`parity: false`): nothing is compared. This
// side renders the frozen ConfirmDialog with the same props, so the reference page still shows the dialog the case is
// about (web/src/dev/previews/FailedConfirmDialog.tsx renders the converted one after a failed Delete).
// The frozen namespace is loaded as kit.ts does (import.meta.glob), so this program never type-checks it.
import type { ComponentType } from 'react';

type ModuleExports = Readonly<Record<string, unknown>>;

const specModules = import.meta.glob<ModuleExports>('../../.reference-src/ui/index.tsx', { eager: true });

export interface FailedConfirmDialogProps {
  traceId: string;
  [prop: string]: unknown;
}

export function FailedConfirmDialog({ traceId: _traceId, ...props }: FailedConfirmDialogProps) {
  const Frozen = specModules['../../.reference-src/ui/index.tsx']?.ConfirmDialog as
    ComponentType<Record<string, unknown>> | undefined;
  if (Frozen === undefined) {
    throw new Error('The frozen spec is missing. Run node visual/reference/extract-spec.mjs (npm run parity does).');
  }
  return <Frozen {...props} />;
}
