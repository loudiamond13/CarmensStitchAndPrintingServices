// The auth layout (App. E.5 frame, UI-SPEC Layout Contract "AuthLayout", spec §8.2; plan 04-26). Every sign-in screen
// renders inside it, always in Blush (`data-theme="light"`), whatever theme the admin shell saved. In keyboard order:
// the skip link, then the brand panel (slab, bands, the outlined "C", the logo, the quote; no landmark, nothing
// interactive), then the form column, which is the one `main#main` and holds the screen's card.
// The toast layer sits inside the page root, as in the other layouts. Like AdminLayout, this layout registers the
// session navigator (a session that ends in another tab can send this tab to sign in) so the public entry never
// imports the session module.
import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router';
import { SkipLink } from '@/components/entry';
import { ToastProvider } from '@/components/feedback';
import { authPageRootClasses } from '@/components/layout/layout.recipe';
import { AuthFrame } from '@/modules/admin/components/AuthFrame';
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
        <AuthFrame>
          <Outlet />
        </AuthFrame>
      </ToastProvider>
    </div>
  );
}
