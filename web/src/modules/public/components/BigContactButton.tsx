// The big contact button (UI-SPEC C1 ContactNowCard; App. E.4 `a.s-bigbtn`): an icon tile, a caps line, an optional note
// and an arrow, as one link. `primary` is the orange Messenger button and `outline` the white Call button. A Messenger or
// `tel:` link opens in the same tab (PUB-06).
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { UiLink } from '@/components/actions/UiLink';
import { Icon } from '@/components/brand/Icon';
import type { IconName } from '@/components/brand/icons';
import {
  bigButtonClasses,
  bigButtonGoClasses,
  bigButtonGoMutedClasses,
  bigButtonNoteClasses,
  bigButtonNoteMutedClasses,
  bigButtonPrimaryClasses,
  bigButtonTileClasses,
  bigButtonTilePrimaryClasses,
  bigButtonTitleClasses,
} from './contact.recipe';

export interface BigContactButtonProps {
  tone: 'primary' | 'outline';
  href: string;
  icon: IconName;
  /** The icon size in px: 26 for Messenger, 24 for the phone. */
  iconSize?: number;
  title: string;
  /** The small line under the title: text, or a part that fills it in later. */
  note?: ReactNode;
}

export function BigContactButton({ tone, href, icon, iconSize = 26, title, note }: BigContactButtonProps) {
  const primary = tone === 'primary';
  return (
    <UiLink to={href} className={clsx(bigButtonClasses, primary && bigButtonPrimaryClasses)}>
      <span className={clsx(bigButtonTileClasses, primary && bigButtonTilePrimaryClasses)}>
        <Icon name={icon} size={iconSize} />
      </span>
      <span>
        <strong className={bigButtonTitleClasses}>{title}</strong>{' '}
        {note !== undefined && (
          <span className={clsx(bigButtonNoteClasses, !primary && bigButtonNoteMutedClasses)}>{note}</span>
        )}
      </span>
      <span className={clsx(bigButtonGoClasses, !primary && bigButtonGoMutedClasses)}>
        <Icon name="arrow-up-right" size={22} />
      </span>
    </UiLink>
  );
}
