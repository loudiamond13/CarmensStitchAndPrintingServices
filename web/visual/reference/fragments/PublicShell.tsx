// Reference side of the public frame (plan 02-29; test only, never shipped): a JSX transcription of the App. E.1 page
// frame, the frozen App. D.3 SiteHeader, then the App. E.3 page head (`section.s-pagehead.s-mesh` with the 48px bottom
// padding) with the Gallery copy (UI-SPEC Copywriting), then the App. E.1 `footer.s-foot` markup, inline styles
// included, with the made-up shop facts (no email row, D-25; no clock row until plan 11-14; the OQ-4 social names) or, for
// `footer="base"`, the App. E.4 one-row footer. App. E.1's design-canvas links become paths (spec §2.9). The
// implementation side renders the real components (web/src/dev/previews/PublicShell.tsx).
//
// The frozen components come from the extracted spec module, loaded the way kit.ts loads it (import.meta.glob, so the
// frozen code is never type-checked).
import type { ComponentType } from 'react';

type ModuleExports = Readonly<Record<string, unknown>>;

const spec = Object.values(import.meta.glob<ModuleExports>('../../.reference-src/ui/index.tsx', { eager: true }))[0];

function frozen<P extends object>(name: string): ComponentType<P> {
  const component = spec?.[name];
  if (typeof component !== 'function') {
    throw new Error(`The frozen spec has no ${name}. Run node visual/reference/extract-spec.mjs.`);
  }
  return component as ComponentType<P>;
}

const SiteHeader = frozen<{ active?: string }>('SiteHeader');
const Logo = frozen<{ size?: string }>('Logo');
const Icon = frozen<{ name: string; size?: number }>('Icon');

/** The made-up shop facts of the parity footer (plan 11-10): the same text the implementation preview primes into the public site store. */
const SITE = {
  name: 'Sample Shop',
  tagline: 'Custom tailoring and full-sublimation printing for teams, leagues and riding groups.',
  address: '12 Sample St., Poblacion, Sample City, Sample Province, Philippines',
  phone: '0917 123 4567',
  year: 2026,
} as const;

export interface PublicShellProps {
  active?: string;
  /** The full four columns, or the one-row footer of Gallery, Contact and the 404 page (App. E.4). */
  footer?: 'full' | 'base';
}

export function PublicShell({ active = 'Home', footer = 'full' }: PublicShellProps) {
  return (
    <>
      <SiteHeader active={active} />
      <section className="s-pagehead s-mesh" style={{ paddingBottom: 48 }}>
        <div className="s-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <nav className="s-crumbs" aria-label="Breadcrumb">
            <a href="/">Home</a>
            <span>/</span>
            <span>Gallery</span>
          </nav>
          <span className="s-eyebrow">Our work</span>
          <h1 className="s-h1">
            Worn on <em>court &amp; road.</em>
          </h1>
          <p className="s-lead">
            Real orders from barangay leagues, school teams, riding clubs and offices. Tap any piece to see it up close.
          </p>
        </div>
      </section>
      <footer className="s-foot">
        <div className="s-wrap">
          {footer === 'full' ? (
            <>
              <div className="s-foot-grid">
                <div>
                  <Logo size="md" />
                  <p className="s-small s-muted" style={{ marginTop: 16, maxWidth: 320 }}>
                    {SITE.tagline}
                  </p>
                  <div className="s-socials">
                    <a className="s-social" href="https://www.facebook.com/cspsdemo" aria-label="FB, CSPS on Facebook">
                      FB
                    </a>
                    <a
                      className="s-social"
                      href="https://www.instagram.com/cspsdemo"
                      aria-label="IG, CSPS on Instagram"
                    >
                      IG
                    </a>
                    <a className="s-social" href="https://www.tiktok.com/@cspsdemo" aria-label="TT, CSPS on TikTok">
                      TT
                    </a>
                  </div>
                </div>
                <div>
                  <h4>Shop</h4>
                  <ul>
                    <li>
                      <a href="/products">Products</a>
                    </li>
                    <li>
                      <a href="/gallery">Gallery</a>
                    </li>
                    <li>
                      <a href="/contact">Get a Quote</a>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4>Visit</h4>
                  <ul>
                    <li>
                      <Icon name="map-pin" size={16} />
                      <span>{SITE.address}</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4>Contact</h4>
                  <ul>
                    <li>
                      <Icon name="phone" size={16} />
                      <a href="tel:+639171234567">{SITE.phone}</a>
                    </li>
                    <li>
                      <Icon name="message-circle" size={16} />
                      <a href="https://m.me/cspsdemo">Message us on Messenger</a>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="s-foot-base">
                <span>{`© ${String(SITE.year)} ${SITE.name}. All rights reserved.`}</span>
                <a className="s-staff" href="/admin/login">
                  <Icon name="lock" size={14} />
                  Staff Login
                </a>
              </div>
            </>
          ) : (
            <div className="s-foot-base" style={{ marginTop: 0, paddingTop: 0, borderTop: 0 }}>
              <Logo size="sm" />
              <span>{`© ${String(SITE.year)} ${SITE.name}`}</span>
              <a className="s-staff" href="/admin/login">
                <Icon name="lock" size={14} />
                Staff Login
              </a>
            </div>
          )}
        </div>
      </footer>
    </>
  );
}
