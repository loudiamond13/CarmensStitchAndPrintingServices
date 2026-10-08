import { Link } from 'react-router';
import type { AnchorHTMLAttributes, ReactNode } from 'react';

/** Adapter so CSPS components navigate with React Router: <LinkProvider component={RouterLink}>. */
export function RouterLink({ to, ...rest }: { to: string; className?: string; children?: ReactNode } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  return <Link to={to} {...rest} />;
}
