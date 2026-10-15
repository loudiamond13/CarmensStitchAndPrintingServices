// SPEC-GAP: Note (UI-SPEC "Component Inventory" → Note; plan 04-26). The App. C `.s-note` look: an 18px icon in the
// text colour, then the text. With `live` it is a polite status, so a notice that appears is read out.
import type { ReactNode } from 'react';
import { Icon } from '@/components/brand';
import { noteClasses } from './states.recipe';

export interface NoteProps {
  icon: 'shield-check' | 'info' | 'circle-check';
  children: ReactNode;
  /** Announces the text when it appears (`role="status"`). */
  live?: boolean;
}

export function Note({ icon, children, live = false }: NoteProps) {
  return (
    <div className={noteClasses} role={live ? 'status' : undefined}>
      <Icon name={icon} size={18} />
      <span>{children}</span>
    </div>
  );
}
