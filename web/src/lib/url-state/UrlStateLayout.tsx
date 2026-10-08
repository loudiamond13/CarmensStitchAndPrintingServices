// The one nuqs adapter (WEB-10). It is mounted as a lazy, pathless layout route above the admin routes (plan 15) and
// later above the Gallery (GAL-01), so public pages without URL state never load nuqs. It renders inside the router
// around <Outlet />, never around RouterProvider.
import { NuqsAdapter } from 'nuqs/adapters/react-router/v8';
import { Outlet } from 'react-router';
import { orderSearchParams, URL_STATE_DEFAULTS } from './defaultOptions';

export default function UrlStateLayout() {
  return (
    <NuqsAdapter defaultOptions={URL_STATE_DEFAULTS} processUrlSearchParams={orderSearchParams}>
      <Outlet />
    </NuqsAdapter>
  );
}
