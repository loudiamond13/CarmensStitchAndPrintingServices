// SPEC-GAP: PhotoTile (UI-SPEC P1 "Photo tile"; D-13, D-14, D-25). One photo in the photo list: row 1 is the 88 px thumb
// and the info column ("Photo {n} of {total}", the description, "Make Cover"); row 2 is the actions, every one a 44 px
// button named per photo. The tile only reports presses; the uploader and the order screens do the work.
//
// A tile has one of five states. Saved and draft photos hold a position (position 1 is the cover). Waiting, uploading
// and failed files are picked files that have no position yet: they show the file name and a status line, with only
// the buttons that fit (Remove; Try Again when the failure can succeed on retry).
//
// SPEC-DEVIATION: D-05 the decorative drag grip is hidden at rest on devices that hover, shown on hover and on keyboard
// focus within the tile, and not drawn where hover is none (touch has no drag). The reveal tokens are below because the
// class gate allows them only in src/components/media/PhotoTile* (class-gate.config.mjs, D-02).
// SPEC-DEVIATION: D-14 "Make Cover" is a text button that is always visible, not App. B's hover-gated star.
// SPEC-DEVIATION: D-13 / OD-14 the 28 px overlay buttons become 44 px buttons below the thumb.
// SPEC-DEVIATION: D-15 busy: every saved-photo control is aria-disabled (it keeps focus and ignores a press) and drag is
// off; the tile's own file buttons (Try Again, Remove) keep working.
// SPEC-DEVIATION: P3 (locked meanwhile) a readonly list still shows Remove on a file that is not part of the order yet,
// so staff can clear it; saved photos show row 1 only.
// SPEC-DEVIATION: jsx-a11y no-noninteractive-element-interactions (research Pitfall 7, D-37) the tile's drag handlers are
// native listeners attached through a callback ref (React 19 ref cleanup), the same events and the same DOM.
import clsx from 'clsx';
import { Button } from '@/components/actions';
import { hitAreaClasses } from '@/components/actions/button.recipe';
import { Icon, MediaPlaceholder } from '@/components/brand';
import { Skeleton } from '@/components/feedback';
import { LazyImage } from '@/components/states';
import { tw } from '@/ui/tw';
import { MEDIA_COPY } from './copy';
import {
  actionsGroupClasses,
  actionsRowClasses,
  actionsRowIdleClasses,
  descriptionClasses,
  fileNameClasses,
  infoClasses,
  makeCoverClasses,
  positionLabelClasses,
  spinnerClasses,
  statusClasses,
  statusIconClasses,
  thumbBoxClasses,
  thumbButtonClasses,
  thumbCoverClasses,
  thumbGripClasses,
  thumbImageClasses,
  thumbPlaceholderClasses,
  thumbRingClasses,
  thumbSkeletonClasses,
  tileClasses,
  tileDraggableClasses,
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
  /** 1 is the cover. Ignored for waiting, uploading and failed files, which have no position. */
  position: number;
  /** How many photos hold a position (saved and draft ones). */
  total: number;
  mode: PhotoMode;
  /** A change or an upload is running. */
  busy: boolean;
  /** The tile can be dragged onto another (hover devices, live and draft, not busy). */
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
  busy,
  canDrag,
  onMove,
  onMakeCover,
  onEditDescription,
  onDelete,
  onRemove,
  onRetry,
  onOpen,
  onDragStart,
  onDragEnd,
  onDropOn,
}: PhotoTileProps) {
  const holdsPosition = photo.state === 'saved' || photo.state === 'draft';
  const saved = photo.state === 'saved';
  const cover = holdsPosition && position === 1;
  const fileName = photo.fileName ?? photo.description;
  const thumbName = COPY.open(position, total, photo.description);

  const tileRef = (item: HTMLLIElement | null) => {
    if (item === null || !canDrag) return;
    const onStart = () => {
      onDragStart(photo.id);
    };
    const onEnd = () => {
      onDragEnd();
    };
    const onOver = (event: DragEvent) => {
      event.preventDefault();
    };
    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      onDropOn(photo.id);
    };
    item.addEventListener('dragstart', onStart);
    item.addEventListener('dragend', onEnd);
    item.addEventListener('dragover', onOver);
    item.addEventListener('drop', onDrop);
    return () => {
      item.removeEventListener('dragstart', onStart);
      item.removeEventListener('dragend', onEnd);
      item.removeEventListener('dragover', onOver);
      item.removeEventListener('drop', onDrop);
    };
  };

  const thumb = () => {
    if (saved) {
      return (
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
      );
    }
    if (photo.previewPending === true) {
      return <Skeleton width="100%" height="100%" radius={0} className={thumbSkeletonClasses} />;
    }
    if (photo.previewUnavailable === true || photo.preview === undefined) {
      return <MediaPlaceholder label={false} ratio="1 / 1" className={thumbPlaceholderClasses} />;
    }
    return <img src={photo.preview} alt="" className={thumbImageClasses} />;
  };

  const noPreview = photo.previewUnavailable === true && <span className={statusClasses.muted}>{COPY.noPreview}</span>;

  const status = () => {
    if (photo.state === 'waiting') {
      return <span className={statusClasses.muted}>{COPY.waiting}</span>;
    }
    if (photo.state === 'uploading') {
      return (
        <span className={statusClasses.muted}>
          <span className={statusIconClasses}>
            <Icon name="loader-circle" size={14} className={spinnerClasses} />
          </span>
          {COPY.uploading}
        </span>
      );
    }
    if (photo.state === 'failed') {
      return (
        <span className={statusClasses.danger}>
          <span className={statusIconClasses}>
            <Icon name="triangle-alert" size={14} />
          </span>
          {COPY.failed(photo.failure?.reason ?? '')}
        </span>
      );
    }
    return null;
  };

  const positionedActions = () => (
    <div className={actionsRowClasses}>
      <div className={actionsGroupClasses}>
        <Button
          variant="secondary"
          icon="chevron-left"
          aria-label={COPY.moveLeft(position)}
          title={COPY.moveLeft(position)}
          aria-disabled={busy || position === 1}
          onClick={() => {
            onMove(photo.id, position - 2);
          }}
        />
        <Button
          variant="secondary"
          icon="chevron-right"
          aria-label={COPY.moveRight(position)}
          title={COPY.moveRight(position)}
          aria-disabled={busy || position === total}
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
          aria-disabled={busy}
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
            aria-disabled={busy}
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
            aria-disabled={busy}
            onClick={() => {
              onRemove(photo.id);
            }}
          />
        )}
      </div>
    </div>
  );

  const fileActions = () => {
    if (photo.state === 'uploading') {
      return <div className={clsx(actionsRowClasses, actionsRowIdleClasses)} />;
    }
    return (
      <div className={actionsRowClasses}>
        <div className={actionsGroupClasses}>
          {photo.state === 'failed' && photo.failure?.retryable === true && (
            <Button
              variant="secondary"
              size="sm"
              icon="rotate-ccw"
              className={hitAreaClasses}
              aria-label={COPY.tryAgainNamed(fileName)}
              title={COPY.tryAgainNamed(fileName)}
              onClick={() => {
                onRetry(photo.id);
              }}
            >
              {COPY.tryAgain}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            icon="x"
            className={hitAreaClasses}
            aria-label={COPY.removeNamed(fileName)}
            title={COPY.removeNamed(fileName)}
            onClick={() => {
              onRemove(photo.id);
            }}
          >
            {COPY.remove}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <li ref={tileRef} className={clsx(tileClasses, canDrag && tileDraggableClasses)} draggable={canDrag || undefined}>
      <div className={tileRowClasses}>
        <div className={clsx(thumbBoxClasses, cover ? thumbRingClasses.cover : thumbRingClasses.plain)}>
          {thumb()}
          {cover && <span className={thumbCoverClasses}>{COPY.cover}</span>}
          {holdsPosition && mode !== 'readonly' && (
            <span className={clsx(thumbGripClasses, gripRevealClasses)} aria-hidden="true">
              <Icon name="grip-vertical" size={16} />
            </span>
          )}
        </div>
        <div className={infoClasses}>
          {holdsPosition ? (
            <>
              <span className={positionLabelClasses}>{COPY.position(position, total)}</span>
              <span className={descriptionClasses}>{photo.description}</span>
              {noPreview}
              {mode !== 'readonly' && !cover && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon="star"
                  className={clsx(makeCoverClasses, hitAreaClasses)}
                  aria-label={COPY.makeCoverNamed(position)}
                  title={COPY.makeCoverNamed(position)}
                  aria-disabled={busy}
                  onClick={() => {
                    onMakeCover(photo.id);
                  }}
                >
                  {COPY.makeCover}
                </Button>
              )}
            </>
          ) : (
            <>
              <span className={fileNameClasses}>{fileName}</span>
              {status()}
              {noPreview}
            </>
          )}
        </div>
      </div>
      {holdsPosition ? mode !== 'readonly' && positionedActions() : fileActions()}
    </li>
  );
}
