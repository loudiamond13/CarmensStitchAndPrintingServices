// RED stub (plan 05-22): the Add User slide-over, written in the GREEN commit.
export interface CreatedUser {
  firstName: string;
  lastName: string;
  role: 'Admin' | 'Manager';
  access: 'invitation' | 'temporary-password';
}

export interface AddUserPanelProps {
  open?: boolean;
  onClose: () => void;
  onCreated: (created: CreatedUser) => void;
}

export function AddUserPanel(props: AddUserPanelProps) {
  void props;
  return null;
}
