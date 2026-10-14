// Dev-only scenario wrapper (plan 02-18; never shipped, D-20): the chip-less MediaPlaceholder (`label={false}`), the
// form tiles, thumbnails and the LazyImage fallback show. The reference side renders the approved look of the same
// thing: App. D.3's MediaPlaceholder with its chip hidden by a parent rule
// (web/visual/reference/fragments/MediaPlaceholderNoChip.tsx).
import { MediaPlaceholder } from '@/components/brand';

export interface MediaPlaceholderNoChipProps {
  ratio?: string;
  number?: string | number;
}

export function MediaPlaceholderNoChip({ ratio, number }: MediaPlaceholderNoChipProps) {
  return <MediaPlaceholder label={false} ratio={ratio} number={number} />;
}
