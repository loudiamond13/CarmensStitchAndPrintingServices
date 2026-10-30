export interface UnsavedChangesGuard {
  allowLeave: () => void;
  dialog: { open: boolean; onKeepEditing: () => void; onDiscard: () => void };
}

export function useUnsavedChangesGuard(_options: { isDirty: boolean }): UnsavedChangesGuard {
  return { allowLeave: () => undefined, dialog: { open: false, onKeepEditing: () => undefined, onDiscard: () => undefined } };
}
