// The Role block of the Add User and Edit User forms (U2, U3): the label, the Admin / Manager control and its hint, or the
// error in the hint's place. `children` sits under the hint (the Edit panel's sign-out note).
import type { ReactNode } from 'react';
import { Icon } from '@/components/brand';
import { SegmentedControl, type SegmentOption } from '@/components/choice';
import { labelClasses, messageClasses } from '@/components/forms';
import { usersRoleBlockClasses } from '@/modules/admin/components/users.recipe';
import { USERS_COPY } from '@/modules/admin/usersCopy';
import type { UserRole } from '@/modules/admin/usersSchemas';

const COPY = USERS_COPY.add.role;

const ROLE_OPTIONS: readonly SegmentOption<UserRole>[] = [
  { value: 'Admin', label: COPY.admin, icon: 'user-round', showLabel: true },
  { value: 'Manager', label: COPY.manager, icon: 'shield-check', showLabel: true },
];

export interface RoleFieldProps {
  value: UserRole;
  onChange: (role: UserRole) => void;
  /** A validation message; it replaces the hint. */
  error?: string | undefined;
  children?: ReactNode;
}

export function RoleField({ value, onChange, error, children }: RoleFieldProps) {
  return (
    <div className={usersRoleBlockClasses}>
      <span className={labelClasses}>{COPY.label}</span>
      <SegmentedControl<UserRole> label={COPY.label} options={ROLE_OPTIONS} value={value} onChange={onChange} />
      <p className={messageClasses({ error: error !== undefined })}>
        {error !== undefined && <Icon name="triangle-alert" size={14} />}
        {error ?? COPY.hint[value]}
      </p>
      {children}
    </div>
  );
}
