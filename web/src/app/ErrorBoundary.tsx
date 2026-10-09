export interface ErrorBoundaryProps {
  reload?: (() => void) | undefined;
}

export const RouteErrorBoundary: (props: ErrorBoundaryProps) => null = () => null;

export const RootErrorBoundary: (props: ErrorBoundaryProps) => null = () => null;

export const ERROR_BOUNDARY_COPY = { title: '', publicBody: '', adminBody: '', reload: '' };
