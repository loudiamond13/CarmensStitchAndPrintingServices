// SPEC-GAP: PhotoViewer (UI-SPEC P4 "Photo viewer"; D-16, D-04, D-27, IMG-04). The order photo viewer: the App. C
// `.s-lightbox` dialog with a "Photo {i} of {n}" counter, Close, Previous and Next (kept on phones, under the photo),
// the photo fitted whole inside its box, the description as caption and "Open Full Size" in a new tab. Generic, so the
// public gallery of a later phase can reuse it. The photos, the shown index and the closing are the caller's.
//
// Like Modal it traps focus, makes the page behind it inert and locks body scroll, and it renders in place, never in a
// portal. Focus starts on Close. Esc closes; ArrowLeft and ArrowRight step from anywhere in the dialog and wrap. Close
// reports the id of the photo shown last, so the caller can put focus back on that photo's thumb.
//
// Live changes: when the photo list changes while the viewer is open, the same photo stays by id, else the nearest
// position (the old position, clamped); with no photos left it calls onClose.
// SPEC-DEVIATION: D-16 Previous and Next stay on phones (see photoViewer.recipe.ts).
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Icon } from '@/components/brand';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { isTopFocusTrap, useBodyScrollLock, useFocusTrap, useInertOutside } from '@/components/overlays';
import { LazyImage } from '@/components/states';
import { MEDIA_COPY } from './copy';
import {
  viewerCaptionClasses,
  viewerCloseClasses,
  viewerCounterClasses,
  viewerDescriptionClasses,
  viewerFullSizeClasses,
  viewerImageClasses,
  viewerNextClasses,
  viewerPreviousClasses,
  viewerRootClasses,
  viewerStageClasses,
  viewerTopClasses,
} from './photoViewer.recipe';

export interface PhotoViewerPhoto {
  id: string;
  /** The description (custom or default): the image's alt text, the caption and the announcement. */
  alt: string;
  /** The viewer-size delivery. Without a stored size the box falls back to 4 / 3. */
  viewer: {
    src: string;
    srcSet: string;
    width?: number | undefined;
    height?: number | undefined;
  };
  /** The full-size address "Open Full Size" opens; without it the link is not rendered. */
  fullSize?: string | undefined;
}

export interface PhotoViewerProps {
  photos: readonly PhotoViewerPhoto[];
  /** The photo shown. */
  index: number;
  onIndexChange: (index: number) => void;
  /** Called with the id of the photo shown last. */
  onClose: (lastShownId: string) => void;
  /** The dialog's accessible name, like "Order photos". */
  label: string;
  /** How wide the photo shows, for the browser to pick from each srcSet. */
  sizes?: string | undefined;
}

/** The box ratio and intrinsic size used when a photo has no stored size. */
const FALLBACK = { width: 4, height: 3, ratio: '4 / 3' } as const;

function clamp(index: number, count: number): number {
  return count === 0 ? -1 : Math.min(Math.max(index, 0), count - 1);
}

interface Anchor {
  /** The photo ids this anchor was taken against, joined. */
  ids: string;
  /** The photo shown, by id, and its position. */
  id: string;
  index: number;
}

export function PhotoViewer({ photos, index, onIndexChange, onClose, label, sizes }: PhotoViewerProps) {
  const ids = photos.map((photo) => photo.id).join('\n');
  const wanted = clamp(index, photos.length);
  const [anchor, setAnchor] = useState<Anchor>({ ids, id: photos[wanted]?.id ?? '', index: wanted });
  let current = wanted;
  // The list changed: stay on the same photo by id, else on the old position, clamped (reset during render).
  if (anchor.ids !== ids) {
    const at = photos.findIndex((photo) => photo.id === anchor.id);
    current = at >= 0 ? at : clamp(anchor.index, photos.length);
    setAnchor({ ids, id: photos[current]?.id ?? anchor.id, index: current });
  } else if (photos.length > 0 && (anchor.id !== photos[wanted]?.id || anchor.index !== wanted)) {
    setAnchor({ ids, id: photos[wanted]?.id ?? anchor.id, index: wanted });
  }

  const lastShownId = photos[current]?.id ?? anchor.id;
  const syncIndex = useEffectEvent(() => {
    if (photos.length === 0) {
      onClose(lastShownId);
    } else if (current !== index) {
      onIndexChange(current);
    }
  });
  useEffect(() => {
    syncIndex();
  }, [current, index, photos.length]);

  if (photos.length === 0) {
    return null;
  }
  return (
    <ViewerDialog
      photos={photos}
      current={current}
      onIndexChange={onIndexChange}
      onClose={onClose}
      label={label}
      sizes={sizes}
    />
  );
}

interface ViewerDialogProps extends Omit<PhotoViewerProps, 'index'> {
  /** The position of the photo shown, always inside the list. */
  current: number;
}

function ViewerDialog({ photos, current, onIndexChange, onClose, label, sizes }: ViewerDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const copy = MEDIA_COPY.viewer;
  const count = photos.length;
  const shown = photos[current];

  useFocusTrap(dialogRef, { initialFocus: closeRef });
  // After the trap, so the trap has captured its trigger before the page goes inert.
  useInertOutside(dialogRef, true);
  useBodyScrollLock(true);

  const step = (delta: number) => {
    if (count > 1) {
      onIndexChange((current + delta + count) % count);
    }
  };
  const close = () => {
    if (shown !== undefined) {
      onClose(shown.id);
    }
  };
  const onStep = useEffectEvent(step);
  const requestClose = useEffectEvent(close);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) {
      return undefined;
    }
    // Alt + Arrow is the browser's own back and forward, so a modifier leaves the key alone.
    const onDialogKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        onStep(event.key === 'ArrowLeft' ? -1 : 1);
      }
    };
    // Only the dialog on top (the newest focus trap) answers Esc.
    const onWindowKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented && isTopFocusTrap(dialog)) {
        event.preventDefault();
        requestClose();
      }
    };
    dialog.addEventListener('keydown', onDialogKey);
    window.addEventListener('keydown', onWindowKey);
    return () => {
      dialog.removeEventListener('keydown', onDialogKey);
      window.removeEventListener('keydown', onWindowKey);
    };
  }, []);

  if (shown === undefined) {
    return null;
  }
  const { width, height } = shown.viewer;
  const sized = width !== undefined && height !== undefined && width > 0 && height > 0;
  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      data-theme="dark"
      className={viewerRootClasses}
    >
      <div className={viewerTopClasses}>
        <span className={viewerCounterClasses}>{copy.counter(current + 1, count)}</span>
        <button ref={closeRef} type="button" className={viewerCloseClasses} aria-label={copy.close} onClick={close}>
          <Icon name="x" size={20} />
        </button>
      </div>
      <div className={viewerStageClasses}>
        {count > 1 && (
          <button
            type="button"
            className={viewerPreviousClasses}
            aria-label={copy.previous}
            onClick={() => {
              step(-1);
            }}
          >
            <Icon name="chevron-left" size={22} />
          </button>
        )}
        <LazyImage
          key={shown.id}
          src={shown.viewer.src}
          srcSet={shown.viewer.srcSet}
          sizes={sizes}
          alt={shown.alt}
          width={sized ? width : FALLBACK.width}
          height={sized ? height : FALLBACK.height}
          ratio={sized ? `${String(width)} / ${String(height)}` : FALLBACK.ratio}
          fit="contain"
          priority
          className={viewerImageClasses}
        />
        {count > 1 && (
          <button
            type="button"
            className={viewerNextClasses}
            aria-label={copy.next}
            onClick={() => {
              step(1);
            }}
          >
            <Icon name="chevron-right" size={22} />
          </button>
        )}
        <div className={viewerCaptionClasses}>
          <p aria-hidden="true" className={viewerDescriptionClasses}>
            {shown.alt}
          </p>
          {shown.fullSize !== undefined && (
            <a href={shown.fullSize} target="_blank" rel="noopener noreferrer" className={viewerFullSizeClasses}>
              <Icon name="arrow-up-right" size={18} />
              {copy.openFullSize}
              <span className={srOnlyClasses}>{copy.opensInNewTab}</span>
            </a>
          )}
        </div>
      </div>
      <div role="status" aria-live="polite" className={srOnlyClasses}>
        {copy.announce(current + 1, count, shown.alt)}
      </div>
    </div>
  );
}
