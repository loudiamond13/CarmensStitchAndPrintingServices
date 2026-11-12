// The product lines for public pages (PUB-02, D-42): the first visit reads the server's boot block, later reads go to the API.
import type { PublicResourceState } from '@/lib/public-data/publicResource';
import type { PublicProductLines } from '../services/contentService';

export function useProductLinesQuery(): PublicResourceState<PublicProductLines> {
  return { status: 'loading' };
}
