// ImageUploader (Phase 9 UI-SPEC P1; App. D.3 / CSPS-UI-SPEC.md §6.3 as amended): the add area and the photo list. It
// is presentational: the photos, the mode and the limits come in as props, and every action goes out to a callback.
// The order screens (F1, O1, X2) wire the callbacks to the queue and the API.
//
// The add area is the dashed drop zone on devices that hover, and "Take Photo" and "Choose Photos" where hover is none
// (the `no-hover` variant, never the width). The photo list is a grid of PhotoTile.
//
// SPEC-DEVIATION: D-08 §6.3 "max 12" becomes the `max` prop (5 from the server rules).
// SPEC-DEVIATION: IMG-02 the hint says "JPG, PNG, WEBP or HEIC" and the pick accepts an explicit list, not `image/*`.
// SPEC-DEVIATION: D-17 touch devices get "Take Photo" (camera) and "Choose Photos" instead of the drop zone.
// SPEC-DEVIATION: D-25 §8.7's mosaic becomes one compact list of tiles.
// SPEC-DEVIATION: D-15 App. D.3's internal list, `defaultImages` and `onChange` are gone: each change is a callback.
// SPEC-DEVIATION: UI-WR-11 each input is emptied after a pick, so a browser fires a change for the same file again.
// SPEC-DEVIATION: UI-CR-01 the component reads no file and makes no `blob:` address; previews are `data:` URLs the caller
// passes in (the strict CSP's img-src allows `data:`).
// SPEC-DEVIATION: jsx-a11y no-static-element-interactions (research Pitfall 7, D-37) the drop zone's drag handlers are
// native listeners attached through a callback ref (React 19 ref cleanup), the same events and the same DOM.
// SPEC-DEVIATION: D-33 the drag-over state is the `data-over` attribute the look reads, instead of the `is-over` class.
// SPEC-DEVIATION: exactOptionalPropertyTypes; the optional props also accept an explicit undefined (same output).
import { useRef, useState, type ChangeEvent } from 'react';
import { Button } from '@/components/actions';
import { Icon } from '@/components/brand';
import { MEDIA_COPY } from './copy';
import {
  dropClasses,
  dropHintClasses,
  dropTitleClasses,
  linkButtonClasses,
  photoListClasses,
  touchAddClasses,
  touchButtonClasses,
  touchHintClasses,
  touchRowClasses,
  uploaderClasses,
} from './media.recipe';
import { PhotoTile, type PhotoMode } from './PhotoTile';
import type { PhotoTileModel } from './photoTile.types';

/** Where picked files came from. */
export type PhotoSource = 'camera' | 'gallery' | 'drop';

export type ImageUploaderMode = PhotoMode;

export interface ImageUploaderProps {
  photos: readonly PhotoTileModel[];
  /** The most photos an order can have (5 from the server rules). */
  max: number;
  /** The size limit shown in the hint, in megabytes. */
  maxMegabytes: number;
  mode: ImageUploaderMode;
  /** A change or an upload is running: every saved-photo control is aria-disabled and drag is off. */
  busy: boolean;
  onAddFiles: (files: File[], source: PhotoSource) => void;
  /** Moves the photo to the 0-based position `toIndex`. */
  onMove: (id: string, toIndex: number) => void;
  onMakeCover: (id: string) => void;
  onEditDescription: (id: string) => void;
  /** A live photo (the caller asks first). */
  onDelete: (id: string) => void;
  /** A draft, waiting or failed photo. */
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onOpen: (id: string) => void;
}

const COPY = MEDIA_COPY.uploader;

export function ImageUploader({
  photos,
  max,
  maxMegabytes,
  mode,
  busy,
  onAddFiles,
  onMove,
  onMakeCover,
  onEditDescription,
  onDelete,
  onRemove,
  onRetry,
  onOpen,
}: ImageUploaderProps) {
  const [over, setOver] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const positioned = photos.filter((photo) => photo.state === 'saved' || photo.state === 'draft');
  const hint = COPY.hint(maxMegabytes, photos.length, max);

  const pick = (source: PhotoSource) => (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length > 0) onAddFiles(files, source);
  };
  const dropZoneRef = (zone: HTMLDivElement | null) => {
    if (zone === null) return;
    const onDragOver = (event: DragEvent) => {
      event.preventDefault();
      setOver(true);
    };
    const onDragLeave = () => {
      setOver(false);
    };
    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      setOver(false);
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length > 0) onAddFiles(files, 'drop');
    };
    zone.addEventListener('dragover', onDragOver);
    zone.addEventListener('dragleave', onDragLeave);
    zone.addEventListener('drop', onDrop);
    return () => {
      zone.removeEventListener('dragover', onDragOver);
      zone.removeEventListener('dragleave', onDragLeave);
      zone.removeEventListener('drop', onDrop);
    };
  };

  return (
    <div className={uploaderClasses}>
      <div ref={dropZoneRef} className={dropClasses} data-over={over}>
        <Icon name="cloud-upload" size={28} />
        <p className={dropTitleClasses}>
          {/* One text node, as in App. D.3: WebKit measures "…or" and " " as two runs 0.3px wider. */}
          {COPY.dropTitle}
          <button
            type="button"
            className={linkButtonClasses}
            onClick={() => {
              galleryRef.current?.click();
            }}
          >
            {COPY.browse}
          </button>
        </p>
        <p className={dropHintClasses}>{hint}</p>
      </div>
      <div className={touchAddClasses}>
        <div className={touchRowClasses}>
          <Button
            variant="secondary"
            icon="camera"
            className={touchButtonClasses}
            onClick={() => {
              cameraRef.current?.click();
            }}
          >
            {COPY.takePhoto}
          </Button>
          <Button
            variant="secondary"
            icon="image"
            className={touchButtonClasses}
            onClick={() => {
              galleryRef.current?.click();
            }}
          >
            {COPY.choosePhotos}
          </Button>
        </div>
        <p className={touchHintClasses}>{hint}</p>
      </div>
      <input
        ref={galleryRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        hidden
        onChange={pick('gallery')}
      />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={pick('camera')} />
      {photos.length > 0 && (
        <ul className={photoListClasses} aria-label={COPY.listName}>
          {photos.map((photo) => {
            const index = positioned.findIndex((candidate) => candidate.id === photo.id);
            return (
              <PhotoTile
                key={photo.id}
                photo={photo}
                position={index + 1}
                total={positioned.length}
                mode={mode}
                busy={busy}
                canDrag={false}
                onMove={onMove}
                onMakeCover={onMakeCover}
                onEditDescription={onEditDescription}
                onDelete={onDelete}
                onRemove={onRemove}
                onRetry={onRetry}
                onOpen={onOpen}
                onDragStart={() => undefined}
                onDragEnd={() => undefined}
                onDropOn={() => undefined}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
