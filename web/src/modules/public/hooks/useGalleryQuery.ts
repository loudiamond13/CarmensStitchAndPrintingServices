import type { PublicResourceState } from '@/lib/public-data/publicResource';
import type { PublicGallery } from '../services/contentService';

export function useGalleryQuery(): PublicResourceState<PublicGallery> {
  return { status: 'loading' };
}
