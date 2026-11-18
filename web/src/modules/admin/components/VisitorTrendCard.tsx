// The Trend card (UI-SPEC V1 item 4). Not built yet.
import type { VisitorStats } from '@/modules/admin/services/visitorStatsService';

export interface VisitorTrendCardProps {
  /** Undefined while the first read runs. */
  stats: VisitorStats | undefined;
}

export function VisitorTrendCard(props: VisitorTrendCardProps) {
  return props.stats === undefined ? null : <section />;
}
