// Gallery item calls (WEB-04, GAL-03). Types come from the generated OpenAPI types (D-16). All eight are the Manager's.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

/** One gallery item (a shown order or an upload) as the Manager's list reads it. */
export type GalleryItem = Schemas['GalleryItemRowDto'];
/** One page of the Manager's list. */
export type GalleryItemPage = Schemas['GalleryItemListDto'];
/** The upload form as the API takes it (JSON on an edit). */
export type GalleryUploadRequest = Schemas['GalleryUploadRequest'];
/** Which way a move goes. */
export type MoveDirection = 'up' | 'down';

/** What the list asks for: a line (null for every line), the page from 1 and the rows per page. */
export interface GalleryListQuery {
  line: string | null;
  page: number;
  pageSize: number;
}

/** What an add sends: the prepared photo and the form fields (each a part of the multipart form). */
export interface GalleryAddForm {
  file: Blob;
  fileName: string;
  teamName: string;
  productLineId: string;
  pieces: number | null;
  note: string;
  isShown: boolean;
}

export interface GalleryItemsService {
  list(query: GalleryListQuery, signal?: AbortSignal): Promise<GalleryItemPage>;
  create(form: GalleryAddForm, idempotencyKey: string, signal?: AbortSignal): Promise<GalleryItem>;
  update(id: string, body: GalleryUploadRequest, signal?: AbortSignal): Promise<GalleryItem>;
  replacePhoto(
    id: string,
    file: Blob,
    fileName: string,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<GalleryItem>;
  move(
    id: string,
    direction: MoveDirection,
    lineId: string | null,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<void>;
  hide(id: string, idempotencyKey: string, signal?: AbortSignal): Promise<void>;
  show(id: string, idempotencyKey: string, signal?: AbortSignal): Promise<void>;
  remove(id: string, signal?: AbortSignal): Promise<void>;
}

const notBuilt = (): never => {
  throw new Error('The gallery service is not built yet.');
};

export function createGalleryItemsService(_client: HttpClient): GalleryItemsService {
  return {
    list: notBuilt,
    create: notBuilt,
    update: notBuilt,
    replacePhoto: notBuilt,
    move: notBuilt,
    hide: notBuilt,
    show: notBuilt,
    remove: notBuilt,
  };
}

export const galleryItemsService: GalleryItemsService = createGalleryItemsService(apiClient);
