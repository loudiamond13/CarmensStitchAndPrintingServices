// SPEC-GAP: PhotoTile (UI-SPEC P1 "Photo tile"; D-13, D-14, D-25). One photo in the photo list: row 1 is the 88 px thumb
// and the info column ("Photo {n} of {total}", the description, "Make Cover"); row 2 is the actions, every one a 44 px
// button named per photo. The tile only reports presses; the uploader and the order screens do the work.
//
// SPEC-DEVIATION: D-05 the decorative drag grip is hidden at rest on devices that hover, shown on hover and on keyboard
// focus within the tile, and not drawn where hover is none (touch has no drag). The reveal tokens are below because the
// class gate allows them only in src/components/media/PhotoTile* (class-gate.config.mjs, D-02).
// SPEC-DEVIATION: D-14 "Make Cover" is a text button that is always visible, not App. B's hover-gated star.
// SPEC-DEVIATION: D-13 / OD-14 the 28 px overlay buttons become 44 px buttons below the thumb.
import clsx from 'clsx';
import { Button } from '@/components/actions';
import { Icon, MediaPlaceholder } from '@/components/brand';
import { hitAreaClasses } from '@/components/actions/button.recipe';
import { LazyImage } from '@/components/states';
import { tw } from '@/ui/tw';
import { MEDIA_COPY } from './copy';
import {
  actionsGroupClasses,
  actionsRowClasses,
  descriptionClasses,
  infoClasses,
  makeCoverClasses,
  positionLabelClasses,
  thumbBoxClasses,
  thumbButtonClasses,
  thumbCoverClasses,
  thumbGripClasses,
  thumbImageClasses,
  thumbPlaceholderClasses,
  thumbRingClasses,
  tileClasses,
  tileRowClasses,
} from './media.recipe';
import type { PhotoTileModel } from './photoTile.types';

/**
 * D-05: hidden at rest where the device hovers; shown while the tile is hovered or has focus anywhere inside it; not
 * drawn where hover is none. These are the only opacity tokens the class gate allows here.
 */
const gripRevealClasses = tw(
  'opacity-0 group-focus-within/thumb:opacity-100 group-hover/thumb:opacity-100 no-hover:hidden',
);

const COPY = MEDIA_COPY.tile;

export type PhotoMode = 'draft' | 'live' | 'readonly';

export interface PhotoTileProps {
  photo: PhotoTileModel;
  /** 1 is the cover. */
  position: number;
  /** How many photos hold a position (saved and draft ones). */
  total: number;
  mode: PhotoMode;
  busy: boolean;
  canDrag: boolean;
  onMove: (id: string, toIndex: number) => void;
  onMakeCover: (id: string) => void;
  onEditDescription: (id: string) => void;
  onDelete: (id: string) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onOpen: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDropOn: (id: string) => void;
}

export function PhotoTile({
  photo,
  position,
  total,
  mode,
  onMove,
  onMakeCover,
  onEditDescription,
  onDelete,
  onRemove,
  onOpen,
}: PhotoTileProps) {
  const cover = position === 1;
  const saved = photo.state === 'saved';
  const thumbName = COPY.open(position, total, photo.description);
  return (
    <li className={tileClasses}>
      <div className={tileRowClasses}>
        <div className={clsx(thumbBoxClasses, cover ? thumbRingClasses.cover : thumbRingClasses.plain)}>
          {saved ? (
            <button
              type="button"
              className={thumbButtonClasses}
              aria-label={thumbName}
              onClick={() => {
                onOpen(photo.id);
              }}
            >
              {photo.thumb === undefined ? (
                <MediaPlaceholder label={false} ratio="1 / 1" className={thumbPlaceholderClasses} />
              ) : (
                <LazyImage
                  src={photo.thumb.src}
                  srcSet={photo.thumb.srcSet}
                  sizes={photo.thumb.sizes}
                  alt=""
                  width={photo.thumb.width ?? 88}
                  height={photo.thumb.height ?? 88}
                  ratio="1 / 1"
                />
              )}
            </button>
          ) : photo.preview === undefined ? (
            <MediaPlaceholder label={false} ratio="1 / 1" className={thumbPlaceholderClasses} />
          ) : (
            <img src={photo.preview} alt="" className={thumbImageClasses} />
          )}
          {cover && <span className={thumbCoverClasses}>{COPY.cover}</span>}
          {mode !== 'readonly' && (
            <span className={clsx(thumbGripClasses, gripRevealClasses)} aria-hidden="true">
              <Icon name="grip-vertical" size={16} />
            </span>
          )}
        </div>
        <div className={infoClasses}>
          <span className={positionLabelClasses}>{COPY.position(position, total)}</span>
          <span className={descriptionClasses}>{photo.description}</span>
          {mode !== 'readonly' && !cover && (
            <Button
              variant="secondary"
              size="sm"
              icon="star"
              className={clsx(makeCoverClasses, hitAreaClasses)}
              aria-label={COPY.makeCoverNamed(position)}
              title={COPY.makeCoverNamed(position)}
              onClick={() => {
                onMakeCover(photo.id);
              }}
            >
              {COPY.makeCover}
            </Button>
          )}
        </div>
      </div>
      {mode !== 'readonly' && (
        <div className={actionsRowClasses}>
          <div className={actionsGroupClasses}>
            <Button
              variant="secondary"
              icon="chevron-left"
              aria-label={COPY.moveLeft(position)}
              title={COPY.moveLeft(position)}
              onClick={() => {
                onMove(photo.id, position - 2);
              }}
            />
            <Button
              variant="secondary"
              icon="chevron-right"
              aria-label={COPY.moveRight(position)}
              title={COPY.moveRight(position)}
              onClick={() => {
                onMove(photo.id, position);
              }}
            />
          </div>
          <div className={actionsGroupClasses}>
            <Button
              variant="secondary"
              icon="pencil"
              aria-label={COPY.editDescription(position)}
              title={COPY.editDescription(position)}
              onClick={() => {
                onEditDescription(photo.id);
              }}
            />
            {saved ? (
              <Button
                variant="ghost-danger"
                icon="trash-2"
                aria-label={COPY.deletePhoto(position)}
                title={COPY.deletePhoto(position)}
                onClick={() => {
                  onDelete(photo.id);
                }}
              />
            ) : (
              <Button
                variant="ghost-danger"
                icon="x"
                aria-label={COPY.removePhoto(position)}
                title={COPY.removePhoto(position)}
                onClick={() => {
                  onRemove(photo.id);
                }}
              />
            )}
          </div>
        </div>
      )}
    </li>
  );
}
