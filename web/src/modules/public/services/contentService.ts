// The public content call (PUB-02, CONT-02): the product lines every visitor sees. Types come from the generated OpenAPI types.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

export type PublicProductLines = components['schemas']['PublicProductLinesDto'];
export type PublicProductLine = components['schemas']['PublicProductLineDto'];

export interface ContentService {
  /** `GET /api/v1/public/product-lines`. */
  getProductLines(signal?: AbortSignal): Promise<PublicProductLines>;
}

export function createContentService(client: HttpClient): ContentService {
  return {
    getProductLines: (signal) => client.get<PublicProductLines>('/public/product-lines', { signal }),
  };
}

export const contentService: ContentService = createContentService(apiClient);
