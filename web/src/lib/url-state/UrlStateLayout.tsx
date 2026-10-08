// RED placeholder (plan 02-11): the adapter without the shared options, so the option tests fail on assertions.
import { NuqsAdapter } from 'nuqs/adapters/react-router/v8';
import { Outlet } from 'react-router';

export default function UrlStateLayout() {
  return (
    <NuqsAdapter>
      <Outlet />
    </NuqsAdapter>
  );
}
