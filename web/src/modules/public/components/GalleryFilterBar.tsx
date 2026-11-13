import type { PublicGalleryPill } from '../services/contentService';

export interface GalleryFilterBarProps {
  pills: readonly PublicGalleryPill[];
  total: number;
  selected: string | null;
  onSelect: (key: string | null) => void;
}

export function GalleryFilterBar(_props: GalleryFilterBarProps) {
  return null;
}
