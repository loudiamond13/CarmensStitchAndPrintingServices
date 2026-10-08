// RED stub (plan 02-17): replaced by the router-aware UiLink and LinkProvider in the GREEN step.
import type { ReactNode } from 'react';

export interface UiLinkProps {
  to: string;
  className?: string;
  children?: ReactNode;
  id?: string;
  title?: string;
  target?: string;
  rel?: string;
  onClick?: () => void;
  'aria-label'?: string;
  'aria-current'?: 'page';
  'aria-describedby'?: string;
}

export function UiLink({ to, children }: UiLinkProps) {
  return <a href={to}>{children}</a>;
}

export interface LinkProviderProps {
  children: ReactNode;
}

export function LinkProvider(_props: LinkProviderProps) {
  return null;
}
