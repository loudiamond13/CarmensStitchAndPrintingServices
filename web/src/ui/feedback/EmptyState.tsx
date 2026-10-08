// RED stub (plan 02-21 Task 1): the converted EmptyState arrives in the GREEN commit.
import type { ReactNode } from 'react';
import type { IconName } from '@/ui/brand';

export type EmptyStateHeadingLevel = 2 | 3 | 4;

export interface EmptyStateProps {
  icon?: IconName | undefined;
  title: string;
  message?: ReactNode;
  action?: ReactNode;
  level?: EmptyStateHeadingLevel | undefined;
}

export function EmptyState(_props: EmptyStateProps) {
  return <div />;
}
