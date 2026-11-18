import type { RankedItem } from '@/modules/admin/services/visitorStatsService';

export interface StatBarListProps {
  items: readonly RankedItem[];
  labelFor?: (name: string) => string;
  emptyText: string;
}

export function StatBarList(_props: StatBarListProps) {
  return null;
}
