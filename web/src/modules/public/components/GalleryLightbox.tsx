import type { PublicGalleryItem } from '../services/contentService';

export interface GalleryLightboxProps {
  items: readonly PublicGalleryItem[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onQuote: () => void;
}

export function GalleryLightbox(_props: GalleryLightboxProps) {
  return null;
}

export default GalleryLightbox;
