// The staff view of the gallery (GAL-03) and its writes (PUB-03; plan 11-32). Not built yet.
import type { SubmissionOptions } from '@/lib/forms/useSubmission';
import type {
  GalleryAddForm,
  GalleryItem,
  GalleryItemPage,
  GalleryListQuery,
  GalleryUploadRequest,
  MoveDirection,
} from '@/modules/admin/services/galleryItemsService';

export const galleryItemsKey = ['gallery-items'] as const;

const notBuilt = (): never => {
  throw new Error('The gallery hooks are not built yet.');
};

export function useGalleryItemsQuery(_params: GalleryListQuery): never {
  return notBuilt();
}

export function useReadGalleryAgain(_params: GalleryListQuery): () => Promise<GalleryItemPage> {
  return notBuilt;
}

type WriteOptions<TData, TResult> = Pick<SubmissionOptions<TData, TResult>, 'onSuccess' | 'onFailure'>;

export function useCreateGalleryUpload(_options: WriteOptions<GalleryAddForm, GalleryItem> = {}): never {
  return notBuilt();
}

export interface UpdateGalleryUploadData {
  id: string;
  body: GalleryUploadRequest;
}

export function useUpdateGalleryUpload(_options: WriteOptions<UpdateGalleryUploadData, GalleryItem> = {}): never {
  return notBuilt();
}

export interface ReplaceGalleryPhotoData {
  id: string;
  file: Blob;
  fileName: string;
}

export function useReplaceGalleryPhoto(_options: WriteOptions<ReplaceGalleryPhotoData, GalleryItem> = {}): never {
  return notBuilt();
}

export interface MoveGalleryItemData {
  id: string;
  direction: MoveDirection;
  lineId: string | null;
}

export function useMoveGalleryItem(_options: WriteOptions<MoveGalleryItemData, undefined> = {}): never {
  return notBuilt();
}

export interface SetGalleryUploadShownData {
  id: string;
  shown: boolean;
}

export function useSetGalleryUploadShown(_options: WriteOptions<SetGalleryUploadShownData, undefined> = {}): never {
  return notBuilt();
}

export function useDeleteGalleryUpload(_options: WriteOptions<string, undefined> = {}): never {
  return notBuilt();
}
