// ProductList (UI-SPEC P1 item 3): the articles of the shown lines in display order. It is its own chunk (lazyProducts.ts)
// so the money formatter, the photo box and the jersey drawings stay out of the Products route's first download (PERF-01).
import type { PublicProductLine } from '../services/contentService';
import { ProductArticle } from './ProductArticle';

export interface ProductListProps {
  lines: readonly PublicProductLine[];
}

export function ProductList({ lines }: ProductListProps) {
  return lines.map((line, index) => <ProductArticle key={line.key} line={line} index={index} total={lines.length} />);
}

export default ProductList;
