// GalleryLightbox (UI-SPEC G2, App. E.3; GAL-02, C-35, D-12, D-13, D-30): the dialog that opens from a Gallery tile. It shows one
// item of the active filter, in gallery order, with its position. Previous and Next move between items and wrap; the arrow keys do
// the same from anywhere in the dialog, Esc closes, and on phones two tap zones over the photo and a swipe take the place of the
// 56px buttons. An item with several photos has a row of thumbnails under the photo. The items, the shown index, the closing and
// the quote hop belong to the Gallery body.
//
// Like Modal it traps focus, makes the page behind it inert and locks body scroll, and it renders in place, never in a portal.
// Focus starts on Close and is not returned here: the Gallery body puts it on the tile of the item last shown.
// It is its own lazy chunk (lazyGallery.ts), loaded the first time a tile is pressed (PERF-01). Deep imports only.
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { buttonClasses } from '@/components/actions/button.recipe';
import { UiLink } from '@/components/actions/UiLink';
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
import { useSwipe } from '../hooks/useSwipe';
import { isLineKey } from '../lineKey';
import type { PublicGalleryItem } from '../services/contentService';
import { artFor, JerseyArt } from './JerseyArt';
import {
  lightboxArtClasses,
  lightboxArtJerseyClasses,
  lightboxCaptionClasses,
  lightboxFrameClasses,
  lightboxImageClasses,
  lightboxMetaClasses,
  lightboxNextClasses,
  lightboxPreviousClasses,
  lightboxStageClasses,
  lightboxTeamClasses,
  lightboxThumbClasses,
  lightboxThumbImageClasses,
  lightboxThumbOnClasses,
  lightboxThumbsClasses,
  lightboxZoneNextClasses,
  lightboxZonePreviousClasses,
} from './galleryLightbox.recipe';

const { lightbox: COPY } = PUBLIC_COPY.gallery;

// UI-SPEC "Image delivery slots": the lightbox photo is at most 907px wide (680px high at 4 / 3), the page width on phones.
const VIEWER_SIZES = '(max-width: 767px) calc(100vw - 32px), 907px';

// SPEC-GAP: the drawn jersey needs a number and a gallery item has none; the hero's "23" is drawn, as the tiles do.
const ART_NUMBER = '23';

// The `.s-a-primary` look at 44px.
const quoteClasses = buttonClasses({ variant: 'primary', size: 'md' });

export interface GalleryLightboxProps {
  /** The items of the active filter, in gallery order. */
  items: readonly PublicGalleryItem[];
  /** The position of the item shown. */
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  /** Called with the quote address when "Get a quote for something like this" is pressed; the page closes the viewer and goes there. */
  onQuote: (to: string) => void;
}

/** The photo chosen with a thumbnail, and the item it was chosen on: another item shows its cover again. */
interface Chosen {
  itemId: string;
  photo: number;
}

export function GalleryLightbox({ items, index, onIndexChange, onClose, onQuote }: GalleryLightboxProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [chosen, setChosen] = useState<Chosen>({ itemId: '', photo: 0 });
  // The polite region's words: an item change or a thumbnail change writes them.
  const [announcement, setAnnouncement] = useState('');
  const count = items.length;
  const item = items[index];

  useFocusTrap(dialogRef, { initialFocus: closeRef, returnFocus: false });
  // After the trap, so the trap has captured its trigger before the page goes inert.
  useInertOutside(dialogRef, true);
  useBodyScrollLock(true);

  const step = (delta: number) => {
    if (count < 2) {
      return;
    }
    const next = (index + delta + count) % count;
    const target = items[next];
    onIndexChange(next);
    // Every item opens on its cover.
    setChosen({ itemId: '', photo: 0 });
    if (target !== undefined) {
      setAnnouncement(COPY.announceItem(next + 1, count, target.team, target.lineShortName));
    }
  };
  const onStep = useEffectEvent(step);
  const requestClose = useEffectEvent(onClose);
  useSwipe(frameRef, {
    onLeft: () => {
      step(1);
    },
    onRight: () => {
      step(-1);
    },
    minDistance: 48,
  });

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

  // A thumbnail that has focus leaves with its item when the next one has fewer photos; focus goes back to Close, not to the page.
  const shownId = item?.id;
  useEffect(() => {
    if (dialogRef.current?.contains(document.activeElement) === false || document.activeElement === document.body) {
      closeRef.current?.focus();
    }
  }, [shownId]);

  if (item === undefined) {
    return null;
  }
  const photoCount = item.photos.length;
  const photoIndex = chosen.itemId === item.id ? Math.min(chosen.photo, Math.max(photoCount - 1, 0)) : 0;
  const photo = item.photos[photoIndex];
  const alt =
    photoCount > 1
      ? COPY.altPhoto(item.team, item.lineShortName, photoIndex + 1, photoCount)
      : COPY.alt(item.team, item.lineShortName);
  const art = artFor(item.placeholderArt);
  // Only a key that passes the allow-list rides in ?product= (T-11-44, Q4).
  const quoteTo = isLineKey(item.lineKey) ? `/contact?product=${item.lineKey}` : '/contact';
  const choosePhoto = (position: number) => {
    setChosen({ itemId: item.id, photo: position });
    setAnnouncement(COPY.announcePhoto(position + 1, photoCount));
  };
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
        <div ref={frameRef} data-lightbox-frame="" className={lightboxFrameClasses}>
          {photo === undefined || photo.viewerSrc === '' ? (
            <div role="img" aria-label={alt} className={lightboxArtClasses}>
              <JerseyArt {...art} number={ART_NUMBER} className={lightboxArtJerseyClasses} />
            </div>
          ) : (
            <LazyImage
              key={`${item.id}:${String(photoIndex)}`}
              src={photo.viewerSrc}
              srcSet={photo.viewerSrcSet}
              sizes={VIEWER_SIZES}
              alt={alt}
              width={Number(photo.width)}
              height={Number(photo.height)}
              ratio="4 / 3"
              fit="contain"
              priority
              className={lightboxImageClasses}
            />
          )}
          {/* SPEC-DEVIATION: C-35 on phones two invisible tap zones replace the 56px buttons (02 D-06). */}
          {count > 1 && (
            <>
              <button
                type="button"
                className={lightboxZonePreviousClasses}
                aria-label={COPY.previousPhoto}
                onClick={() => {
                  step(-1);
                }}
              />
              <button
                type="button"
                className={lightboxZoneNextClasses}
                aria-label={COPY.nextPhoto}
                onClick={() => {
                  step(1);
                }}
              />
            </>
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
      {photoCount > 1 && (
        <div className={lightboxThumbsClasses}>
          {item.photos.map((thumb, position) => (
            <button
              key={position}
              type="button"
              className={position === photoIndex ? lightboxThumbOnClasses : lightboxThumbClasses}
              aria-label={COPY.showPhoto(position + 1, photoCount)}
              aria-current={position === photoIndex ? 'true' : undefined}
              onClick={() => {
                choosePhoto(position);
              }}
            >
              <LazyImage
                src={thumb.thumbSrc}
                width={56}
                height={56}
                ratio="1 / 1"
                alt=""
                className={lightboxThumbImageClasses}
              />
            </button>
          ))}
        </div>
      )}
      <div className={lightboxCaptionClasses}>
        <p className={lightboxTeamClasses}>{item.team}</p>
        <p className={lightboxMetaClasses}>
          {COPY.meta(item.lineShortName, item.pieces === null ? null : Number(item.pieces), item.note)}
        </p>
        <UiLink
          to={quoteTo}
          className={quoteClasses}
          onClick={(event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
              return;
            }
            event.preventDefault();
            onQuote(quoteTo);
          }}
        >
          {COPY.getQuote}
        </UiLink>
      </div>
      <div role="status" aria-live="polite" className={srOnlyClasses}>
        {announcement}
      </div>
    </div>
  );
}

export default GalleryLightbox;
