// RED stub (plan 02-26 Task 3): the converted Topbar arrives in GREEN.
import type { Role } from '@/lib/csps';

export interface TopbarProps {
  user?: { name: string };
  role?: Role;
  placeholder?: string;
  onMenu?: () => void;
  menuExpanded?: boolean;
  menuControls?: string;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onSearch?: (query: string) => void;
}
export function Topbar(_props: TopbarProps) {
  return <div data-stub="" />;
}
