// The auth page frame (App. E.5 `.s-login` grid, UI-SPEC Layout Contract "AuthLayout"; plan 04-26, split out by plan 04-32
// so the parity preview can draw it without the router and session wiring of AuthLayout). It holds the brand panel (slab,
// bands, the outlined "C", the logo, the quote; no landmark, nothing interactive), which is identical on every auth
// screen, and the form column, which is the one `main#main` and holds the screen's card.
import type { ReactNode } from 'react';
import { Logo } from '@/components/brand';
import {
  loginBandsClasses,
  loginBrandClasses,
  loginClasses,
  loginEyebrowClasses,
  loginFixedClasses,
  loginFormColumnClasses,
  loginLogoClasses,
  loginNumeralClasses,
  loginQuoteClasses,
  loginQuoteTextClasses,
  loginSlabClasses,
} from '@/components/layout/layout.recipe';
import { AUTH_COPY } from '@/modules/admin/authCopy';

export interface AuthFrameProps {
  /** The screen's card, inside the one `main`. */
  children: ReactNode;
  /** A fixed page height in px (the parity preview, which has no viewport height to follow); otherwise `min-h-dvh`. */
  minHeight?: number;
}

/** The `.s-login` grid: the brand panel and the form column (`main#main`) holding the screen's card. */
export function AuthFrame({ children, minHeight }: AuthFrameProps) {
  return (
    <div
      className={minHeight === undefined ? loginClasses : loginFixedClasses}
      style={{ '--login-h': minHeight === undefined ? undefined : `${String(minHeight)}px` }}
    >
      <div className={loginBrandClasses}>
        <div className={loginSlabClasses} aria-hidden="true" />
        <div className={loginBandsClasses} aria-hidden="true" />
        <span className={loginNumeralClasses} aria-hidden="true">
          C
        </span>
        <div className={loginLogoClasses}>
          <Logo size="lg" context="login" />
        </div>
        <div className={loginQuoteClasses}>
          <span className={loginEyebrowClasses}>{AUTH_COPY.brand.eyebrow}</span>
          <p className={loginQuoteTextClasses}>{AUTH_COPY.brand.quote}</p>
        </div>
      </div>
      <main id="main" tabIndex={-1} className={loginFormColumnClasses}>
        {children}
      </main>
    </div>
  );
}
