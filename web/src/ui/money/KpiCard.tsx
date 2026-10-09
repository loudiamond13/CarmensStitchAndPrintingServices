// RED stub (plan 02-23): the converted KpiCard arrives in GREEN.
import type { IconName } from '@/ui/brand';

export interface KpiCardProps {
  label: string;
  value: number | string;
  money?: boolean | undefined;
  icon?: IconName | undefined;
  delta?: number | undefined;
  deltaLabel?: string | undefined;
  hint?: string | undefined;
  loading?: boolean | undefined;
}

export function KpiCard(_props: KpiCardProps) {
  return <div />;
}
