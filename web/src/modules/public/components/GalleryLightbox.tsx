// GalleryLightbox (UI-SPEC G2, App. E.3; GAL-02, C-35, D-30): the dialog that opens from a Gallery tile. It shows one item of the
// active filter, in gallery order, with its position. Previous and Next move between items and wrap; the arrow keys do the same
// from anywhere in the dialog, and Esc closes. The items, the shown index and the closing belong to the Gallery body.
//
// Like Modal it traps focus, makes the page behind it inert and locks body scroll, and it renders in place, never in a portal.
// Focus starts on Close and is not returned here: the Gallery body puts it on the tile of the item last shown.
// It is its own lazy chunk (lazyGallery.ts), loaded the first time a tile is pressed (PERF-01). Deep imports only.
import { useEffect, useEffectEvent, useRef } from 'react';
import { Icon } from '@/components/brand/Icon';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import {
  viewerCloseClasses,
  viewerCounterClasses,
  viewerRootClasses,
  viewerTopClasses,
} from '@/components/media/photoViewer.recipe';
import { useBodyScrollLock } from '@/components/overlays/useBodyScrollLock';
import { isTopFocusTrap, useFocusTrap } from '@/components/overlays/useFocusTrap';
import { useInertOutside } from '@/components/overlays/useInertOutside';
import { LazyImage } from '@/components/states/LazyImage';
import { PUBLIC_COPY } from '../copy';
import type { PublicGalleryItem } from '../services/contentService';
import {
  lightboxFrameClasses,
  lightboxImageClasses,
  lightboxNextClasses,
  lightboxPreviousClasses,
  lightboxStageClasses,
} from './galleryLightbox.recipe';

const { lightbox: COPY } = PUBLIC_COPY.gallery;

// UI-SPEC "Image delivery slots": the lightbox photo is at most 907px wide (680px high at 4 / 3), the page width on phones.
const VIEWER_SIZES = '(max-width: 767px) calc(100vw - 32px), 907px';

export interface GalleryLightboxProps {
  /** The items of the active filter, in gallery order. */
  items: readonly PublicGalleryItem[];
  /** The position of the item shown. */
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  /** Called when "Get a quote for something like this" is pressed; the page closes the viewer and goes to /contact. */
  onQuote: () => void;
}

export function GalleryLightbox({ items, index, onIndexChange, onClose }: GalleryLightboxProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const count = items.length;
  const item = items[index];

  useFocusTrap(dialogRef, { initialFocus: closeRef, returnFocus: false });
  // After the trap, so the trap has captured its trigger before the page goes inert.
  useInertOutside(dialogRef, true);
  useBodyScrollLock(true);

  const step = (delta: number) => {
    if (count > 1) {
      onIndexChange((index + delta + count) % count);
    }
  };
  const onStep = useEffectEvent(step);
  const requestClose = useEffectEvent(onClose);

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

  if (item === undefined) {
    return null;
  }
  const photo = item.photos[0];
  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={COPY.dialog}
      tabIndex={-1}
      data-theme="dark"
      className={viewerRootClasses}
    >
      <div className={viewerTopClasses}>
        {/* SPEC-DEVIATION: A11Y-POS the visible position is hidden from assistive technology; a hidden "Item 3 of 16" says it. */}
        <span aria-hidden="true" className={viewerCounterClasses}>
          {COPY.position(index + 1, count)}
        </span>
        <span className={srOnlyClasses}>{COPY.positionHidden(index + 1, count)}</span>
        <button ref={closeRef} type="button" className={viewerCloseClasses} aria-label={COPY.close} onClick={onClose}>
          <Icon name="x" size={20} />
        </button>
      </div>
      <div className={lightboxStageClasses}>
        {count > 1 && (
          <button
            type="button"
            className={lightboxPreviousClasses}
            aria-label={COPY.previousImage}
            onClick={() => {
              step(-1);
            }}
          >
            <Icon name="chevron-left" size={22} />
          </button>
        )}
        <div className={lightboxFrameClasses}>
          {photo !== undefined && (
            <LazyImage
              key={item.id}
              src={photo.viewerSrc}
              srcSet={photo.viewerSrcSet}
              sizes={VIEWER_SIZES}
              alt={COPY.alt(item.team, item.lineShortName)}
              width={Number(photo.width)}
              height={Number(photo.height)}
              ratio="4 / 3"
              fit="contain"
              priority
              className={lightboxImageClasses}
            />
          )}
        </div>
        {count > 1 && (
          <button
            type="button"
            className={lightboxNextClasses}
            aria-label={COPY.nextImage}
            onClick={() => {
              step(1);
            }}
          >
            <Icon name="chevron-right" size={22} />
          </button>
        )}
      </div>
    </div>
  );
}

export default GalleryLightbox;
