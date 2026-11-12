// ProductMedia (UI-SPEC P1 item 3, D-02): the main photo or the drawn jersey, and the back and fabric photos or placeholders.
import type { PublicProductLine } from '../services/contentService';

export interface ProductMediaProps {
  line: PublicProductLine;
}

export function ProductMedia({ line }: ProductMediaProps) {
  void line;
  return null;
}
