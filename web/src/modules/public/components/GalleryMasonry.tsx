import type { PublicGalleryItem } from '../services/contentService';

export interface GalleryMasonryProps {
  items: readonly PublicGalleryItem[];
  shown: number;
  focusIndex?: number | null;
  onOpen?: (itemIndex: number) => void;
}

export function GalleryMasonry(_props: GalleryMasonryProps) {
  return null;
}
