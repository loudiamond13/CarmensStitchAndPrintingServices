// The spec Icon (App. D.3) as a thin wrapper over lucide-react (D-10, D-34). The svg keeps the App. D.3 wrapper:
// width and height = size, viewBox 0 0 24 24, fill none, stroke currentColor, stroke width 2, round caps and joins
// (lucide's defaults), and the .csp-icon look as utilities (D-33).
// SPEC-DEVIATION: D-10 lucide-react wrapper; lucide adds its own `lucide lucide-<name>` classes (accepted, D-28).
// SPEC-DEVIATION: D-33 props are explicit (no spread of other svg props), so callers cannot restyle the primitive;
// `className` stays for the context colour a src/ui parent passes to an icon it renders itself.
import clsx from 'clsx';
import { tw } from '@/ui/tw';
import { ICONS, type IconName } from './icons';

export interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  /** Names the icon (role img). Without it the icon is decorative and hidden from assistive technology. */
  label?: string;
  className?: string;
}

/** The .csp-icon look (App. B): `flex: none; display: inline-block; vertical-align: middle`. */
const iconClasses = tw('inline-block flex-none align-middle');

export function Icon({ name, size = 20, strokeWidth = 2, label, className }: IconProps) {
  const Drawing = ICONS[name];
  // As App. D.3: an empty label counts as no label, so the icon is hidden rather than an unnamed image.
  const named = label !== undefined && label !== '';
  return (
    <Drawing
      width={size}
      height={size}
      strokeWidth={strokeWidth}
      className={clsx(iconClasses, className)}
      aria-hidden={named ? undefined : true}
      role={named ? 'img' : undefined}
      aria-label={label}
    />
  );
}
