// RED stub (plan 02-31 Task 2).
import type { AdminSection } from '@/ui/navigation';

export interface TabBarProps {
  active?: AdminSection | undefined;
}

export function TabBar(props: TabBarProps) {
  return props.active === undefined ? null : null;
}
