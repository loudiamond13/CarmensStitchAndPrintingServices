// The public footer (UI-SPEC Layout Contract "Footer", App. E.1 `footer.s-foot` markup, spec §7.1 item 8), with the
// App. C `.s-foot*`, `.s-socials`, `.s-social`, `.s-staff`, `.s-small`, `.s-muted` and `.s-wrap` looks transcribed to
// utilities, including their `@container pg` rules (two columns up to 1023px, one column on phones). App. C's 1023px
// block is written as `pg-tablet:` (768-1023px), so the phone rule never has to out-order it.
//   - The shop facts come from the stored site data (useSiteQuery, PUB-02). A fact that is not set leaves its row out.
//     While the facts load the Visit and Contact columns show skeleton lines; if the read fails the rows that need
//     them are dropped and Shop and Staff Login stay.
//   - App. E.1's "Products.dc.html" style links become router links to the public paths (spec §2.9).
// SPEC-DEVIATION: FOOTER App. E.1's footer text is fixed; here the values are the stored ones and the year is the
// server's business-calendar year.
// SPEC-DEVIATION: D-25 no email row: the shop email is never shown on a public page.
// SPEC-DEVIATION: D-33 (OQ-4) each social link's spoken name is "FB, CSPS on Facebook" and so on; nothing visible changes.
// SPEC-DEVIATION: D-41 R2-17 (owner, 2026-10-13) the column titles Shop, Visit and Contact are h2 instead of App. E.1's
// h4, so the page's headings go h1 → h2 (Lighthouse heading order). Preflight resets heading size, weight and margin,
// and the look comes from the classes, so nothing visible changes.
import { Suspense } from 'react';
import { UiLink } from '@/components/actions/UiLink';
import { Icon } from '@/components/brand/Icon';
import { Logo } from '@/components/brand/Logo';
import { tw } from '@/ui/tw';
import { PUBLIC_COPY } from '../copy';
import { useSiteQuery } from '../hooks/useSiteQuery';
import { addressLine, mainPhone, telHref } from '../siteFacts';
import type { PublicSite } from '../services/siteService';
import { LazyFooterHours } from './lazyHours';
import { SkeletonLines } from './SkeletonLines';

const { footer: FOOTER } = PUBLIC_COPY;

/** The Shop column: the public pages. */
const SHOP_LINKS = [
  { text: FOOTER.links.products, to: '/products' },
  { text: FOOTER.links.gallery, to: '/gallery' },
  { text: FOOTER.links.getQuote, to: '/contact' },
] as const;

// The clock row (summarizeOpenDays, in FooterHours) loads on its own, so no page's first download carries the hours
// formatters (PERF-01).
const columnTitleClasses = tw('mb-4 font-display text-[16px] font-bold tracking-[.12em] text-ink-muted uppercase');
const columnListClasses = tw('flex flex-col gap-3 text-[14px] leading-5');
const rowClasses = tw('flex items-start gap-2');
const rowLinkClasses = tw('no-underline hover:text-accent-ink');
const staffLinkClasses = tw('inline-flex items-center gap-[6px] text-ink-subtle no-underline hover:text-ink');
/** The base footer: the full footer's shell (App. C `.s-foot`), with its 96px bottom padding on phones, which keeps the Contact bar off the last row. */
const baseFooterClasses = tw('border-t border-line bg-bg pt-16 pb-8 pg-phone:pb-[96px]');

/** The social squares for the links that are set, in the order FB, IG, TT. */
function socialsOf(site: PublicSite) {
  return [
    { ...FOOTER.socials.facebook, href: site.facebookUrl },
    { ...FOOTER.socials.instagram, href: site.instagramUrl },
    { ...FOOTER.socials.tiktok, href: site.tiktokUrl },
  ].filter((social): social is typeof social & { href: string } => social.href !== null);
}

function VisitColumn({ site }: { site: PublicSite | undefined }) {
  const address = site === undefined ? '' : addressLine(site.address);
  return (
    <div>
      <h2 className={columnTitleClasses}>{FOOTER.columns.visit}</h2>
      {site === undefined ? (
        <SkeletonLines />
      ) : (
        <ul className={columnListClasses}>
          <li className={rowClasses}>
            <Icon name="map-pin" size={16} className="mt-px text-ink-muted" />
            <span>{address}</span>
          </li>
          <Suspense fallback={null}>
            <LazyFooterHours site={site} />
          </Suspense>
        </ul>
      )}
    </div>
  );
}

function ContactColumn({ site }: { site: PublicSite | undefined }) {
  const phone = site === undefined ? undefined : mainPhone(site);
  return (
    <div>
      <h2 className={columnTitleClasses}>{FOOTER.columns.contact}</h2>
      {site === undefined ? (
        <SkeletonLines />
      ) : (
        <ul className={columnListClasses}>
          {phone !== undefined && (
            <li className={rowClasses}>
              <Icon name="phone" size={16} className="mt-px text-ink-muted" />
              <UiLink to={telHref(phone)} className={rowLinkClasses}>
                {phone.display}
              </UiLink>
            </li>
          )}
          {site.messengerUrl !== null && (
            <li className={rowClasses}>
              <Icon name="message-circle" size={16} className="mt-px text-ink-muted" />
              <UiLink to={site.messengerUrl} className={rowLinkClasses}>
                {FOOTER.messenger}
              </UiLink>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function StaffLogin() {
  return (
    <UiLink to="/admin/login" className={staffLinkClasses}>
      <Icon name="lock" size={14} />
      {FOOTER.staffLogin}
    </UiLink>
  );
}

export interface SiteFooterProps {
  /** The full four columns (Home, Products) or one row (Gallery, Contact, 404). */
  variant?: 'full' | 'base';
}

export function SiteFooter({ variant = 'full' }: SiteFooterProps) {
  const query = useSiteQuery();
  const site = query.status === 'success' ? query.data : undefined;
  if (variant === 'base') {
    return (
      <footer className={baseFooterClasses}>
        <div className="mx-auto max-w-(--container-max) px-6 pg-phone:px-4">
          <div className="flex flex-wrap justify-between gap-3 text-[12px] leading-4 text-ink-subtle">
            <Logo size="sm" />
            {site !== undefined && <span>{FOOTER.baseCopyright(Number(site.year), site.businessName)}</span>}
            <StaffLogin />
          </div>
        </div>
      </footer>
    );
  }
  const failed = query.status === 'error';
  const socials = site === undefined ? [] : socialsOf(site);
  const showVisit = !failed && (site === undefined || addressLine(site.address) !== '');
  const showContact = !failed && (site === undefined || mainPhone(site) !== undefined || site.messengerUrl !== null);
  return (
    <footer className="border-t border-line bg-bg pt-16 pb-8 pg-phone:pb-[96px]">
      <div className="mx-auto max-w-(--container-max) px-6 pg-phone:px-4">
        <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-8 pg-phone:grid-cols-[minmax(0,1fr)] pg-phone:gap-6 pg-tablet:grid-cols-[1fr_1fr]">
          <div>
            <Logo size="md" context="footer" />
            {site !== undefined && (
              <p className="mt-4 max-w-[320px] text-[14px] leading-5 text-ink-muted">{site.tagline}</p>
            )}
            {socials.length > 0 && (
              <div className="mt-5 flex gap-2">
                {socials.map((social) => (
                  <UiLink
                    key={social.short}
                    to={social.href}
                    aria-label={social.name}
                    className="grid size-11 place-items-center rounded-sm border border-line-strong font-display text-[15px] font-bold no-underline hover:border-accent-line hover:text-accent-ink"
                  >
                    {social.short}
                  </UiLink>
                ))}
              </div>
            )}
          </div>
          <div>
            <h2 className={columnTitleClasses}>{FOOTER.columns.shop}</h2>
            <ul className={columnListClasses}>
              {SHOP_LINKS.map((link) => (
                <li key={link.to} className={rowClasses}>
                  <UiLink to={link.to} className={rowLinkClasses}>
                    {link.text}
                  </UiLink>
                </li>
              ))}
            </ul>
          </div>
          {showVisit && <VisitColumn site={site} />}
          {showContact && <ContactColumn site={site} />}
        </div>
        <div className="mt-12 flex flex-wrap justify-between gap-3 border-t-2 border-dashed border-line pt-6 text-[12px] leading-4 text-ink-subtle">
          {site !== undefined && <span>{FOOTER.copyright(Number(site.year), site.businessName)}</span>}
          <StaffLogin />
        </div>
      </div>
    </footer>
  );
}
