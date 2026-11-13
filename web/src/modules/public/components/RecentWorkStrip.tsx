import type { PublicRecentWork } from '../services/contentService';

export interface RecentWorkStripProps {
  items: readonly PublicRecentWork[];
}

export function RecentWorkStrip({ items }: RecentWorkStripProps) {
  return items.length === 0 ? null : <div />;
}

export function RecentWorkSkeletons() {
  return <div />;
}
