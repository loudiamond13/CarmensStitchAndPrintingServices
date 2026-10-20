// The page body of the admin shell previews (AdminShell, OpenedNavDrawer): the dev preview page where the dev routes
// exist, and nothing in a production build, so AdminPreviewPage and its "Development only" copy never ship with the
// component showcase (D-33, D-41 Q3). `__DEV_ROUTES__` is a literal false there, and the choice is made at module level
// so the bundler drops the unused import.
import type { AdminSection } from '@/components/navigation';
import { AdminPreviewPage } from '@/modules/admin/pages/AdminPreviewPage';

const Body = __DEV_ROUTES__ ? AdminPreviewPage : null;

export function PreviewBody({ section }: { section: AdminSection }) {
  return Body === null ? null : <Body section={section} />;
}
