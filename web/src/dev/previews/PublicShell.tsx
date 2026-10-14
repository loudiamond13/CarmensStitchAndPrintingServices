// Dev-only scenario wrapper (plan 02-29; never shipped, D-20): the public frame as the PublicLayout renders it, with the
// real components: the SiteHeader, the D-21 PublicPlaceholderPage and the SiteFooter, side by side in the case frame
// (the frame itself is the page root). It leaves out what has no counterpart in App. E.1: the visually hidden skip link,
// the unstyled `main` wrapper with its min-height, and the toast layer. The parity page already provides the router.
// With `header` and `footer` off it shows the page head alone. The reference side renders the App. E.1 header and
// footer and the App. E.2 page head with the same copy (web/visual/reference/fragments/PublicShell.tsx).
import { PublicPlaceholderPage } from '@/app/public/PublicPlaceholderPage';
import { SiteFooter } from '@/app/public/SiteFooter';
import { SiteHeader } from '@/ui/navigation';

export interface PublicShellProps {
  /** The current header link's label. */
  active?: string;
  header?: boolean;
  footer?: boolean;
}

export function PublicShell({ active = 'Home', header = true, footer = true }: PublicShellProps) {
  return (
    <>
      {header && <SiteHeader active={active} />}
      <PublicPlaceholderPage />
      {footer && <SiteFooter />}
    </>
  );
}
