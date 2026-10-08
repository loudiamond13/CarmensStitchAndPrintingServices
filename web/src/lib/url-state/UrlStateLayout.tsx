// RED placeholder (02-08 Task 2): replaced in GREEN.
import { NuqsAdapter } from 'nuqs/adapters/react-router/v8';
import { Outlet } from 'react-router';
import { URL_STATE_DEFAULTS } from './defaultOptions';

export default function UrlStateLayout() {
  return (
    <NuqsAdapter defaultOptions={URL_STATE_DEFAULTS}>
      <Outlet />
    </NuqsAdapter>
  );
}
