// U3 Edit User slide-over (stub for the RED commit; plan 05-25).
export interface EditUserPanelProps {
  userId: string | null;
  open?: boolean;
  onClose: () => void;
  onSaved: (saved: unknown) => void;
}

export function EditUserPanel(_props: EditUserPanelProps) {
  return null;
}
