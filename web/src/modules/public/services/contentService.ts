// The public content calls (PUB-02, CONT-02): the product lines and the Home data every visitor sees. Types come from the generated OpenAPI types.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

export type PublicProductLines = components['schemas']['PublicProductLinesDto'];
export type PublicProductLine = components['schemas']['PublicProductLineDto'];
export type PublicHome = components['schemas']['PublicHomeDto'];
export type PublicHomeLine = components['schemas']['PublicHomeLineDto'];
export type PublicTestimonial = components['schemas']['PublicTestimonialDto'];
export type PublicGallery = components['schemas']['PublicGalleryDto'];
export type PublicGalleryItem = components['schemas']['PublicGalleryItemDto'];
export type PublicGalleryPhoto = components['schemas']['PublicGalleryPhotoDto'];
export type PublicGalleryPill = components['schemas']['PublicGalleryPillDto'];
export type PublicRecentWork = components['schemas']['PublicRecentWorkDto'];
export type PublicHeroTag = components['schemas']['PublicHeroTagDto'];

export interface ContentService {
  /** `GET /api/v1/public/product-lines`. */
  getProductLines(signal?: AbortSignal): Promise<PublicProductLines>;
  /** `GET /api/v1/public/home`. */
  getHome(signal?: AbortSignal): Promise<PublicHome>;
  /** `GET /api/v1/public/gallery`. */
  getGallery(signal?: AbortSignal): Promise<PublicGallery>;
}

export function createContentService(client: HttpClient): ContentService {
  return {
    getProductLines: (signal) => client.get<PublicProductLines>('/public/product-lines', { signal }),
    getHome: (signal) => client.get<PublicHome>('/public/home', { signal }),
    getGallery: (signal) => client.get<PublicGallery>('/public/gallery', { signal }),
  };
}

export const contentService: ContentService = createContentService(apiClient);
