// Avatar (App. D.3 "Status", CSPS-UI-SPEC.md §6.2), converted to utilities (D-33) with the same props API and markup:
// a span holding the initials of the first two words, named for the person.
// SPEC-DEVIATION: D-31 O-1 the span gets the img role, so its aria-label is a valid name (owner-approved; no visible
// change).
// SPEC-DEVIATION: D-33 strict CSP: the size and the font size (App. D.3's max(10, round(size × .38)) formula) go through
// the --avatar-size and --avatar-fs custom properties, read by the utilities next to the style below, instead of
// inline width, height and font-size (UI-SPEC "Inline style rule").
import clsx from 'clsx';
import { avatarClasses } from './status.recipe';

export interface AvatarProps {
  /** The person's name: the initials come from its first two words, and it names the image. */
  name?: string | undefined;
  /** Diameter in px. */
  size?: number | undefined;
  /** Layout glue only (margin, placement); never a restyle (spec rule 3). */
  className?: string | undefined;
}

export function Avatar({ name = '', size = 36, className }: AvatarProps) {
  // SPEC-DEVIATION: noUncheckedIndexedAccess (TS2532): charAt(0) is p[0] for the non-empty words left by filter.
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
  const fontSize = Math.max(10, Math.round(size * 0.38));
  return (
    <span
      className={clsx(avatarClasses, 'size-(--avatar-size) text-(length:--avatar-fs)', className)}
      style={{ '--avatar-size': `${String(size)}px`, '--avatar-fs': `${String(fontSize)}px` }}
      role="img"
      aria-label={name}
    >
      {initials}
    </span>
  );
}
