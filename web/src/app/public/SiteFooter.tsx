// The public footer (UI-SPEC Layout Contract "Footer", App. E.1 `footer.s-foot` markup, spec §7.1 item 8), with the
// App. C `.s-foot*`, `.s-socials`, `.s-social`, `.s-staff`, `.s-small`, `.s-muted` and `.s-wrap` looks transcribed to
// utilities, including their `@container pg` rules (two columns up to 1023px, one column on phones). App. C's 1023px
// block is written as `pg-tablet:` (768-1023px), so the phone rule never has to out-order it.
//   - The bracketed placeholders and the `#` links come from SITE_CONTACT (one typed module, spec §0 rule 5).
//   - App. E.1's "Products.dc.html" style links become router links to the public paths (spec §2.9).
// SPEC-DEVIATION: D-31 O-4 each social link's name has a space between "on" and the network (App. E.1 reads
// "CSPS onFacebook"); a spoken label only, nothing visible changes.
// SPEC-DEVIATION: D-41 R2-17 (owner, 2026-10-13) the column titles Shop, Visit and Contact are h2 instead of App. E.1's
// h4, so the page's headings go h1 → h2 (Lighthouse heading order). Preflight resets heading size, weight and margin,
// and the look comes from the classes, so nothing visible changes.
import { UiLink } from '@/ui/actions';
import { Icon, Logo } from '@/ui/brand';
import { SITE_CONTACT } from './siteContact';

/** The three social squares: the text shown and the accessible name (D-31 O-4). */
const SOCIALS = [
  { short: 'FB', name: 'CSPS on Facebook', href: SITE_CONTACT.social.facebook },
  { short: 'IG', name: 'CSPS on Instagram', href: SITE_CONTACT.social.instagram },
  { short: 'TT', name: 'CSPS on TikTok', href: SITE_CONTACT.social.tiktok },
] as const;

/** The Shop column: the public pages. */
const SHOP_LINKS = [
  { text: 'Products', to: '/products' },
  { text: 'Gallery', to: '/gallery' },
  { text: 'Get a Quote', to: '/contact' },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-bg pt-16 pb-8 pg-phone:pb-[96px]">
      <div className="mx-auto max-w-(--container-max) px-6 pg-phone:px-4">
        <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-8 pg-phone:grid-cols-[minmax(0,1fr)] pg-phone:gap-6 pg-tablet:grid-cols-[1fr_1fr]">
          <div>
            <Logo size="md" context="footer" />
            <p className="mt-4 max-w-[320px] text-[14px] leading-5 text-ink-muted">
              Custom tailoring and full-sublimation printing for teams, leagues and riding groups.
            </p>
            <div className="mt-5 flex gap-2">
              {SOCIALS.map((social) => (
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
          </div>
          <div>
            <h2 className="mb-4 font-display text-[16px] font-bold tracking-[.12em] text-ink-muted uppercase">Shop</h2>
            <ul className="flex flex-col gap-3 text-[14px] leading-5">
              {SHOP_LINKS.map((link) => (
                <li key={link.to} className="flex items-start gap-2">
                  <UiLink to={link.to} className="no-underline hover:text-accent-ink">
                    {link.text}
                  </UiLink>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="mb-4 font-display text-[16px] font-bold tracking-[.12em] text-ink-muted uppercase">Visit</h2>
            <ul className="flex flex-col gap-3 text-[14px] leading-5">
              <li className="flex items-start gap-2">
                <Icon name="map-pin" size={16} className="mt-px text-ink-muted" />
                <span>{SITE_CONTACT.address}</span>
              </li>
              <li className="flex items-start gap-2">
                <Icon name="clock" size={16} className="mt-px text-ink-muted" />
                <span>{SITE_CONTACT.hours}</span>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="mb-4 font-display text-[16px] font-bold tracking-[.12em] text-ink-muted uppercase">
              Contact
            </h2>
            <ul className="flex flex-col gap-3 text-[14px] leading-5">
              <li className="flex items-start gap-2">
                <Icon name="phone" size={16} className="mt-px text-ink-muted" />
                <UiLink to={SITE_CONTACT.phone.href} className="no-underline hover:text-accent-ink">
                  {SITE_CONTACT.phone.text}
                </UiLink>
              </li>
              <li className="flex items-start gap-2">
                <Icon name="message-circle" size={16} className="mt-px text-ink-muted" />
                <UiLink to={SITE_CONTACT.messenger.href} className="no-underline hover:text-accent-ink">
                  {SITE_CONTACT.messenger.text}
                </UiLink>
              </li>
              <li className="flex items-start gap-2">
                <Icon name="mail" size={16} className="mt-px text-ink-muted" />
                <UiLink to={SITE_CONTACT.email.href} className="no-underline hover:text-accent-ink">
                  {SITE_CONTACT.email.text}
                </UiLink>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-wrap justify-between gap-3 border-t-2 border-dashed border-line pt-6 text-[12px] leading-4 text-ink-subtle">
          <span>© 2026 Carmen&apos;s Stitch &amp; Printing Services. All rights reserved.</span>
          <UiLink
            to="/admin/login"
            className="inline-flex items-center gap-[6px] text-ink-subtle no-underline hover:text-ink"
          >
            <Icon name="lock" size={14} />
            Staff Login
          </UiLink>
        </div>
      </div>
    </footer>
  );
}
