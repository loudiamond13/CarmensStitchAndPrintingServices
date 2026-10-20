// The one nuqs adapter (WEB-10). The default export is for `route.lazy`: the app mounts it as a lazy, pathless layout
// route above the admin routes and above every public route that keeps URL state (today the Gallery, GAL-01), so
// public pages without URL state never load nuqs. It renders inside the router around <Outlet />, never around
// RouterProvider.
//
// Never render <Navigate> to set or change query params (nuqs #1245): redirect from a route loader with redirect().
//
// It hands the Outlet context of the layout above it to the page below it. An Outlet gives its pages only its own
// context, so without this the admin layout's theme (PROF-04) would stop here.
import { NuqsAdapter } from 'nuqs/adapters/react-router/v8';
import { Outlet, useOutletContext } from 'react-router';
import { orderSearchParams, URL_STATE_DEFAULTS } from './defaultOptions';

export default function UrlStateLayout() {
  const context: unknown = useOutletContext();
  return (
    <NuqsAdapter defaultOptions={URL_STATE_DEFAULTS} processUrlSearchParams={orderSearchParams}>
      <Outlet context={context} />
    </NuqsAdapter>
  );
}
