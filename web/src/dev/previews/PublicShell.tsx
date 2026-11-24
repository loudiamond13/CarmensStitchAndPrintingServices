// Dev-only scenario wrapper (plan 02-29; never shipped, D-20): the public frame as the PublicLayout renders it, with the
// real components: the SiteHeader, the inner-page head (the Gallery head, App. E.3) and the SiteFooter, side by side in the
// case frame (the frame itself is the page root). It leaves out what has no counterpart in App. E.1: the visually hidden
// skip link, the unstyled `main` wrapper with its min-height, and the toast layer. The parity page already provides the
// router. The reference side renders the App. E.1 header and footer and the App. E.3 page head with the same copy
// (web/visual/reference/fragments/PublicShell.tsx).
// Plan 11-10: the footer reads the shop facts from the public site store, so this file primes that store with fixed, made-up
// facts before anything renders (no request is made). The reference fragment writes the same text. `footer="base"` shows the
// one-row footer of Gallery, Contact and the 404 page.
import { SiteHeader } from '@/components/navigation';
import { PageHead } from '@/modules/public/components/PageHead';
import { SiteFooter } from '@/modules/public/components/SiteFooter';
import { PUBLIC_COPY } from '@/modules/public/copy';
import { siteResource } from '@/modules/public/hooks/useSiteQuery';
import type { PublicSite } from '@/modules/public/services/siteService';

/** The made-up shop facts of the parity footer. The reference fragment repeats them as text. */
export const PARITY_SITE: PublicSite = {
  businessName: 'Sample Shop',
  tagline: 'Custom tailoring and full-sublimation printing for teams, leagues and riding groups.',
  aboutText: null,
  turnaroundLine: null,
  address: {
    street: '12 Sample St., Poblacion',
    townOrCity: 'Sample City',
    province: 'Sample Province',
    postalCode: '1000',
  },
  phones: [{ display: '0917 123 4567', e164: '+639171234567', label: 'Globe', isMain: true }],
  messengerUrl: 'https://m.me/cspsdemo',
  facebookUrl: 'https://www.facebook.com/cspsdemo',
  instagramUrl: 'https://www.instagram.com/cspsdemo',
  tiktokUrl: 'https://www.tiktok.com/@cspsdemo',
  directionsUrl: null,
  mapEmbedUrl: null,
  year: 2026,
  hours: [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, opensAt: null, closesAt: null })),
  upcomingClosures: [],
};

siteResource.prime(PARITY_SITE);

export interface PublicShellProps {
  /** The current header link's label. */
  active?: string;
  /** The footer: the full four columns (Home, Products) or the base row (Gallery, Contact, 404). */
  footer?: 'full' | 'base';
}

export function PublicShell({ active = 'Home', footer = 'full' }: PublicShellProps) {
  const { eyebrow, headline, lead } = PUBLIC_COPY.gallery;
  return (
    <>
      <SiteHeader active={active} />
      <PageHead flat crumb={PUBLIC_COPY.crumbs.gallery} eyebrow={eyebrow} headline={headline} lead={lead} />
      <SiteFooter variant={footer} />
    </>
  );
}
