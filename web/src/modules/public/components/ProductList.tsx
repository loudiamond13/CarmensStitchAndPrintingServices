// ProductList (UI-SPEC P1 item 3): the articles of the shown lines in display order. It is its own chunk (lazyProducts.ts)
// so the money formatter, the photo box and the jersey drawings stay out of the Products route's first download (PERF-01).
import { useEffect } from 'react';
import type { PublicProductLine } from '../services/contentService';
import { ProductArticle } from './ProductArticle';

export interface ProductListProps {
  lines: readonly PublicProductLine[];
  /** Called once the articles are on screen, so the page can scroll to the one named in the address. */
  onShown?: (() => void) | undefined;
}

export function ProductList({ lines, onShown }: ProductListProps) {
  useEffect(() => {
    onShown?.();
  }, [onShown]);
  return lines.map((line, index) => <ProductArticle key={line.key} line={line} index={index} total={lines.length} />);
}

export default ProductList;
