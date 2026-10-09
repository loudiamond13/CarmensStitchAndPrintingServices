// Reference side of the public frame (plan 02-29; test only, never shipped): a JSX transcription of the App. E.1 page
// frame, the frozen App. D.3 SiteHeader, then the App. E.2 page head (`section.s-pagehead.s-mesh`) with the D-21
// placeholder copy (UI-SPEC Copywriting) in place of the Products copy and with no breadcrumb, then the App. E.1
// `footer.s-foot` markup verbatim, inline styles included. App. E.1's design-canvas links become paths (spec §2.9).
// The implementation side renders the real components (web/src/dev/previews/PublicShell.tsx).
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

/** App. E.1's placeholder links, kept until the public-site phase binds real values (UI-SPEC D-08 note). */
const PLACEHOLDER = '#';

export interface PublicShellProps {
  active?: string;
  header?: boolean;
  footer?: boolean;
}

export function PublicShell({ active = 'Home', header = true, footer = true }: PublicShellProps) {
  return (
    <>
      {header && <SiteHeader active={active} />}
      <section className="s-pagehead s-mesh">
        <div className="s-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <span className="s-eyebrow">Custom sublimation · Philippines</span>
          <h1 className="s-h1">
            Site update <em>in progress.</em>
          </h1>
          <p className="s-lead">
            We&apos;re building our new website. To order now, message us on Messenger or call the shop. The details are
            below.
          </p>
        </div>
      </section>
      {footer && (
        <footer className="s-foot">
          <div className="s-wrap">
            <div className="s-foot-grid">
              <div>
                <Logo size="md" />
                <p className="s-small s-muted" style={{ marginTop: 16, maxWidth: 320 }}>
                  Custom tailoring and full-sublimation printing for teams, leagues and riding groups.
                </p>
                <div className="s-socials">
                  <a className="s-social" href={PLACEHOLDER} aria-label="CSPS onFacebook">
                    FB
                  </a>
                  <a className="s-social" href={PLACEHOLDER} aria-label="CSPS onInstagram">
                    IG
                  </a>
                  <a className="s-social" href={PLACEHOLDER} aria-label="CSPS onTikTok">
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
                    <span>[Shop address], [City], Philippines</span>
                  </li>
                  <li>
                    <Icon name="clock" size={16} />
                    <span>Mon–Sat · 9:00 AM – 6:00 PM</span>
                  </li>
                </ul>
              </div>
              <div>
                <h4>Contact</h4>
                <ul>
                  <li>
                    <Icon name="phone" size={16} />
                    <a href={PLACEHOLDER}>[0917 000 0000]</a>
                  </li>
                  <li>
                    <Icon name="message-circle" size={16} />
                    <a href={PLACEHOLDER}>Message us on Messenger</a>
                  </li>
                  <li>
                    <Icon name="mail" size={16} />
                    <a href={PLACEHOLDER}>[hello@yourdomain.ph]</a>
                  </li>
                </ul>
              </div>
            </div>
            <div className="s-foot-base">
              <span>© 2026 Carmen&apos;s Stitch &amp; Printing Services. All rights reserved.</span>
              <a className="s-staff" href="/admin/login">
                <Icon name="lock" size={14} />
                Staff Login
              </a>
            </div>
          </div>
        </footer>
      )}
    </>
  );
}
