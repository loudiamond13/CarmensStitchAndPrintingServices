import type { ReactNode } from 'react';

export interface PageHeadProps {
  eyebrow: string;
  headline: { readonly plain: string; readonly accent: string };
  crumb?: string;
  lead?: string;
  actions?: ReactNode;
  flat?: boolean;
}

export function PageHead(_props: PageHeadProps) {
  return null;
}
