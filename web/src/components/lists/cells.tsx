// SPEC-GAP: list cells (UI-SPEC "SPEC-GAP Primitive Specs" → ResponsiveTable; App. E.7/E.12 cell markup; WEB-06). The
// cell contents every admin list composes inside a ResponsiveTable:
//   - UserCell: App. E.12's `.csp-cell-user` (a 36px avatar, the name in bold and a sub line). App. B's
//     `.csp-cell-user span` rule reaches every span in it, so the avatar initials, the name and the sub line all take
//     12px `--ink-muted` exactly as App. E.12 renders them (rule 8; owner question logged, D-08).
//   - CustomerCell: App. E.7's `.s-who` (the team over the customer, or the customer over "Walk-in customer"; the
//     shared WALK_IN_CUSTOMER, owner ruling D-40, so the card and the table rows always match).
//   - RowActions and RowAction: App. E.7/E.12's `.s-acts` group of 36px `.s-iconbtn` buttons (18px icons), each named
//     for its row ("Edit Carmen Reyes"); the danger one hovers in `--danger-soft` / `--danger`.
// The looks are in lists.recipe.ts.
import type { ReactNode, Ref } from 'react';
import { Icon, type IconName } from '@/components/brand';
import { WALK_IN_CUSTOMER } from '@/components/data';
import { Avatar } from '@/components/status';
import {
  cellUserClasses,
  cellUserNameClasses,
  cellUserSubClasses,
  cellUserTextClasses,
  rowActionClasses,
  rowActionsClasses,
  whoSubClasses,
  whoTitleClasses,
} from './lists.recipe';

export interface UserCellProps {
  /** The person's full name: the avatar initials and the bold line. */
  name: string;
  /** The line under the name: "You" on the signed-in user's row, else the role. */
  sub: ReactNode;
}

export function UserCell({ name, sub }: UserCellProps) {
  return (
    <span className={cellUserClasses}>
      <Avatar name={name} size={36} context="cellUser" />
      <span className={cellUserTextClasses}>
        <strong className={cellUserNameClasses}>{name}</strong>
        <span className={cellUserSubClasses}>{sub}</span>
      </span>
    </span>
  );
}

export interface CustomerCellProps {
  /** The team; an order without one is a walk-in. */
  team?: string | null | undefined;
  customer: string;
}

export function CustomerCell({ team, customer }: CustomerCellProps) {
  const hasTeam = team !== undefined && team !== null && team !== '';
  return (
    <div>
      <strong className={whoTitleClasses}>{hasTeam ? team : customer}</strong>
      <span className={whoSubClasses}>{hasTeam ? customer : WALK_IN_CUSTOMER}</span>
    </div>
  );
}

export interface RowActionsProps {
  /** The row's RowAction buttons. */
  children?: ReactNode;
}

export function RowActions({ children }: RowActionsProps) {
  return <span className={rowActionsClasses}>{children}</span>;
}

interface RowActionCommon {
  icon: IconName;
  /** The accessible name, naming the row: "Edit Carmen Reyes". */
  label: string;
  /** A tooltip (App. E.12 gives the activate/deactivate toggle one). */
  title?: string | undefined;
  /** The `.is-danger` hover (Delete). */
  danger?: boolean | undefined;
  /** An in-app path: the action is a router link in the same look, not a button. */
  to?: string | undefined;
}

export interface RowActionButtonProps extends RowActionCommon {
  to?: undefined;
  onClick?: (() => void) | undefined;
  /** The button element, for a screen that moves focus to it after a row changes. */
  ref?: Ref<HTMLButtonElement> | undefined;
}

export interface RowActionLinkProps extends RowActionCommon {
  to: string;
  onClick?: undefined;
  /** The anchor element. */
  ref?: Ref<HTMLAnchorElement> | undefined;
}

export type RowActionProps = RowActionButtonProps | RowActionLinkProps;

export function RowAction({ icon, label, title, danger = false, to, onClick, ref }: RowActionProps) {
  const tone: keyof typeof rowActionClasses = danger ? 'danger' : 'neutral';
  // RED stub: the link form is not built yet and renders as a plain button.
  if (to !== undefined) {
    return (
      <button type="button" aria-label={label} title={title} className={rowActionClasses[tone]}>
        <Icon name={icon} size={18} />
      </button>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      className={rowActionClasses[tone]}
      onClick={onClick}
      ref={ref}
    >
      <Icon name={icon} size={18} />
    </button>
  );
}
