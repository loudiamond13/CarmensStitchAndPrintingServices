import type { RankedItem } from '@/modules/admin/services/visitorStatsService';

export interface DeviceBrowserCardProps {
  devices: readonly RankedItem[] | undefined;
  browsers: readonly RankedItem[] | undefined;
}

export function DeviceBrowserCard(_props: DeviceBrowserCardProps) {
  return null;
}
