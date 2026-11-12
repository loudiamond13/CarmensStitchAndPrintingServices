// AnchorPills (UI-SPEC P1 item 2, D-32): the sticky bar of one pill link per shown line.
import type { PublicProductLine } from '../services/contentService';

export interface AnchorPillsProps {
  lines: readonly PublicProductLine[];
}

export function AnchorPills({ lines }: AnchorPillsProps) {
  void lines;
  return null;
}
