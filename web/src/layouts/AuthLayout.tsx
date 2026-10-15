// The auth layout (App. E.5 frame, UI-SPEC Layout Contract "AuthLayout", spec §8.2; plan 04-26). Every sign-in screen
// renders inside it, always in Blush (`data-theme="light"`), whatever theme the admin shell saved. In keyboard order:
// the skip link, then the brand panel (slab, bands, the outlined "C", the logo, the quote; no landmark, nothing
// interactive), then the form column, which is the one `main#main` and holds the screen's card.
// The toast layer sits inside the page root, as in the other layouts. Like AdminLayout, this layout registers the
// session navigator (a session that ends in another tab can send this tab to sign in) so the public entry never
// imports the session module.
import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router';
import { Logo } from '@/components/brand';
import { SkipLink } from '@/components/entry';
import { ToastProvider } from '@/components/feedback';
import {
  authPageRootClasses,
  loginBandsClasses,
  loginBrandClasses,
  loginClasses,
  loginEyebrowClasses,
  loginFormColumnClasses,
  loginLogoClasses,
  loginNumeralClasses,
  loginQuoteClasses,
  loginQuoteTextClasses,
  loginSlabClasses,
} from '@/components/layout/layout.recipe';
import { AUTH_COPY } from '@/modules/admin/authCopy';
import { setNavigator } from '@/modules/admin/services/session';

export default function AuthLayout() {
  const navigate = useNavigate();
  useEffect(() => {
    setNavigator((to) => {
      void navigate(to);
    });
  }, [navigate]);
  return (
    <div data-theme="light" className={authPageRootClasses}>
      <ToastProvider>
        <SkipLink />
        <div className={loginClasses}>
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
            <Outlet />
          </main>
        </div>
      </ToastProvider>
    </div>
  );
}
