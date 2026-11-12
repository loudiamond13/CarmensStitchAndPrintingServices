// Dev-only scenario wrapper (plan 02-29; never shipped, D-20): the public frame as the PublicLayout renders it, with the
// real components: the SiteHeader, the inner-page head (the Gallery head, App. E.3) and the SiteFooter, side by side in the
// case frame (the frame itself is the page root). It leaves out what has no counterpart in App. E.1: the visually hidden
// skip link, the unstyled `main` wrapper with its min-height, and the toast layer. The parity page already provides the
// router. The reference side renders the App. E.1 header and footer and the App. E.3 page head with the same copy
// (web/visual/reference/fragments/PublicShell.tsx).
import { SiteHeader } from '@/components/navigation';
import { PageHead } from '@/modules/public/components/PageHead';
import { SiteFooter } from '@/modules/public/components/SiteFooter';
import { PUBLIC_COPY } from '@/modules/public/copy';

export interface PublicShellProps {
  /** The current header link's label. */
  active?: string;
}

export function PublicShell({ active = 'Home' }: PublicShellProps) {
  const { eyebrow, headline, lead } = PUBLIC_COPY.gallery;
  return (
    <>
      <SiteHeader active={active} />
      <PageHead flat crumb={PUBLIC_COPY.crumbs.gallery} eyebrow={eyebrow} headline={headline} lead={lead} />
      <SiteFooter />
    </>
  );
}
