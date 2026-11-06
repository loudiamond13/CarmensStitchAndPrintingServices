// The photo model the uploader and the tile share (plan 09-08; UI-SPEC P1).

export type PhotoTileState = 'saved' | 'draft' | 'waiting' | 'uploading' | 'failed';

/** The delivered tile-size picture of a saved photo. */
export interface PhotoThumb {
  src: string;
  srcSet?: string | undefined;
  sizes?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
}

export interface PhotoTileModel {
  id: string;
  state: PhotoTileState;
  /** The description to show (the caller works out the default text from the position). */
  description: string;
  /** The picked file's name, shown on waiting, uploading and failed tiles. */
  fileName?: string | undefined;
  /** A saved photo's delivered picture. */
  thumb?: PhotoThumb | undefined;
  /** A `data:` preview of a picked file. */
  preview?: string | undefined;
  /** The preview is still being made. */
  previewPending?: boolean | undefined;
  /** The browser cannot draw this file; it shows after upload. */
  previewUnavailable?: boolean | undefined;
  failure?: { reason: string; retryable: boolean } | undefined;
}
