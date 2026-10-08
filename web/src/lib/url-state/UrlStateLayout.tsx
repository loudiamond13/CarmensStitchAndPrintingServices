// The one nuqs adapter (WEB-10). The default export is for `route.lazy`: the app mounts it as a lazy, pathless layout
// route above the admin routes and above every public route that keeps URL state (today the Gallery, GAL-01), so
// public pages without URL state never load nuqs. It renders inside the router around <Outlet />, never around
// RouterProvider.
//
// Never render <Navigate> to set or change query params (nuqs #1245): redirect from a route loader with redirect().
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
