// SPEC-GAP: Note (UI-SPEC "Component Inventory" → Note; plan 04-26). The App. C `.s-note` look: an 18px icon in the
// text colour, then the text. With `live` it is a polite status, so a notice that appears is read out.
// SPEC-DEVIATION: Q3 (plan 13-02) the `triangle-alert` note is a warning: the icon is `--warning` and the text is `--ink`.
import type { ReactNode } from 'react';
import { Icon } from '@/components/brand';
import { noteClasses, noteTextClasses, noteWarningIconClasses, noteWarningTextClasses } from './states.recipe';

export interface NoteProps {
  icon: 'shield-check' | 'info' | 'circle-check' | 'triangle-alert';
  children: ReactNode;
  /** Announces the text when it appears (`role="status"`). */
  live?: boolean;
}

export function Note({ icon, children, live = false }: NoteProps) {
  const warning = icon === 'triangle-alert';
  return (
    <div className={noteClasses} role={live ? 'status' : undefined}>
      <Icon name={icon} size={18} className={warning ? noteWarningIconClasses : ''} />
      <span className={warning ? noteWarningTextClasses : noteTextClasses}>{children}</span>
    </div>
  );
}
