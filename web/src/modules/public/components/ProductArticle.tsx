// ProductArticle (UI-SPEC P1 item 3): one product line with its media, number, texts, customize cards and price.
import type { PublicProductLine } from '../services/contentService';

export interface ProductArticleProps {
  line: PublicProductLine;
  /** Zero-based position among the shown lines. */
  index: number;
  /** How many lines are shown. */
  total: number;
}

export function ProductArticle({ line, index, total }: ProductArticleProps) {
  void line;
  void index;
  void total;
  return null;
}
