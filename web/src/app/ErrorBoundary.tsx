// SPEC-GAP: ErrorBoundary (UI-SPEC "SPEC-GAP Primitive Specs" → ErrorBoundary; WEB-05). The route-level error screens:
// an EmptyState with the `triangle-alert` icon, the Copywriting title and body, and a primary md "Reload Page" button
// that reloads the page. A render crash and a route chunk that fails to load (after a deploy replaced it) show the same
// screen.
//   - RouteErrorBoundary sits on the layout's child routes, so the screen renders inside the layout's `main` and the
//     header and footer stay.
//   - RootErrorBoundary sits on the root route and catches what the layout itself throws: a minimal Blush page root
//     (always light, D-14) with `main#main` and the same content.
// The screens never show the error itself (CWE-209). They log nothing; in production the createRoot and RouterProvider
// error callbacks are no-ops too (main.tsx), so a crash leaves the console empty. The wrapper around the EmptyState is
// the `.s-wrap` container with page-head spacing, so the screen lines up with the page content.
import { Button } from '@/ui/actions';
import { EmptyState } from '@/ui/feedback';
import { pageRootClasses } from '@/ui/layout/layout.recipe';

/** The Copywriting strings (UI-SPEC "Global error boundary"). The admin body is for the admin layout (plan 02-31). */
export const ERROR_BOUNDARY_COPY = {
  title: 'Something went wrong',
  publicBody: "This page couldn't load. Reload the page to try again.",
  adminBody: "This screen couldn't load. Reload the page to try again. Your saved data is safe.",
  reload: 'Reload Page',
} as const;

export interface ErrorBoundaryProps {
  /** Reloads the page; tests pass their own. React Router renders the boundaries without props. */
  reload?: (() => void) | undefined;
}

function reloadPage(): void {
  window.location.reload();
}

function ErrorScreen({ reload }: { reload: () => void }) {
  return (
    <div className="mx-auto max-w-(--container-max) px-6 py-16 pg-phone:px-4 pg-phone:py-8">
      <EmptyState
        icon="triangle-alert"
        title={ERROR_BOUNDARY_COPY.title}
        message={ERROR_BOUNDARY_COPY.publicBody}
        action={
          <Button variant="primary" onClick={reload}>
            {ERROR_BOUNDARY_COPY.reload}
          </Button>
        }
      />
    </div>
  );
}

/** The error screen inside the layout's `main` (a page crashed or its chunk failed to load). */
export function RouteErrorBoundary({ reload = reloadPage }: ErrorBoundaryProps) {
  return <ErrorScreen reload={reload} />;
}

/** The error screen in a minimal page root of its own (the layout itself failed). */
export function RootErrorBoundary({ reload = reloadPage }: ErrorBoundaryProps) {
  return (
    <div data-theme="light" className={pageRootClasses}>
      <main id="main" tabIndex={-1}>
        <ErrorScreen reload={reload} />
      </main>
    </div>
  );
}
