// SPEC-GAP: gallery tab
// S6 GalleryPhotoModal (plan 11-32). Not built yet.
import type { GalleryItem } from '@/modules/admin/services/galleryItemsService';

interface GalleryPhotoModalCommon {
  open?: boolean;
  onClose: () => void;
  onSaved: (saved: GalleryItem) => void;
}

export interface AddGalleryPhotoModalProps extends GalleryPhotoModalCommon {
  mode: 'add';
}

export interface EditGalleryPhotoModalProps extends GalleryPhotoModalCommon {
  mode: 'edit';
  item: GalleryItem | null;
  /** Reads the list again and gives back the item as the server holds it now (Load Latest). */
  readLatest: (id: string) => Promise<GalleryItem | undefined>;
}

export type GalleryPhotoModalProps = AddGalleryPhotoModalProps | EditGalleryPhotoModalProps;

export function GalleryPhotoModal(_props: GalleryPhotoModalProps) {
  return null;
}
