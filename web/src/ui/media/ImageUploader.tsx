// ImageUploader (App. D.3, CSPS-UI-SPEC.md §6.3), converted to utilities (D-33) with the App. D.3 props, markup and
// copy: the dashed drop zone ("Drag images here or browse", the "{n}/{max}" hint, a hidden image-only file input),
// then the thumbnail grid. The first image is the cover (the "Cover" tag and the accent ring); thumbnails reorder by
// native drag; each has "Make cover image" (not on the cover) and "Remove {name}". The looks are in media.recipe.ts.
// Uploads themselves, and their type and size checks, arrive in Phase 9 (IMG-01); the full keyboard reorder is Phase 9.
//
// SPEC-DEVIATION: D-05 (C-35, owner) the thumb grip and actions are hidden at rest on devices that hover, appear on
// hover and on keyboard focus within the thumb (App. D.3 shows only the actions on focus within), and are always
// visible on touch (`hover: none`). The focused control is never the faded element. The reveal tokens are below
// because the class gate allows them only in src/ui/media/ImageUploader* (class-gate.config.mjs, D-02).
// SPEC-DEVIATION: jsx-a11y no-static-element-interactions / no-noninteractive-element-interactions (research
// Pitfall 7, D-37). The drop zone and thumbnail drag handlers are native listeners attached through callback refs
// (React 19 ref cleanup) instead of JSX props on static elements; same events, same DOM.
// SPEC-DEVIATION: D-33 the drag-over state is the `data-over` attribute the look reads, instead of the `is-over` class.
// SPEC-DEVIATION: D-33 a thumbnail without a photo is MediaPlaceholder `label={false}` (the App. B `.csp-thumb
// .csp-media-ph-label { display: none }` parent rule as a prop, plan 02-18); it is named "No image yet" and the
// remove button still names the file.
// SPEC-DEVIATION: exactOptionalPropertyTypes; the optional props also accept an explicit undefined (same output).
import clsx from 'clsx';
import { useRef, useState } from 'react';
import type { OrderImage } from '@/lib/csps';
import { Icon, MediaPlaceholder } from '@/ui/brand';
import { tw } from '@/ui/tw';
import {
  dropClasses,
  dropHintClasses,
  dropTitleClasses,
  linkButtonClasses,
  thumbActionsClasses,
  thumbButtonClasses,
  thumbClasses,
  thumbCoverClasses,
  thumbGripClasses,
  thumbImageClasses,
  thumbPlaceholderClasses,
  thumbRingClasses,
  thumbsClasses,
  uploaderClasses,
} from './media.recipe';

/**
 * D-05: hidden at rest where the device hovers; shown while the thumb is hovered, while focus is anywhere inside it,
 * and always on a device without hover. These are the only opacity tokens the class gate allows here.
 */
const thumbRevealClasses = tw(
  'opacity-0 group-focus-within/thumb:opacity-100 group-hover/thumb:opacity-100 no-hover:opacity-100',
);

/** Drag-drop or browse; thumbnails; drag to reorder; the first image is the cover. */
export interface ImageUploaderProps {
  images?: OrderImage[] | undefined;
  defaultImages?: OrderImage[] | undefined;
  onChange?: ((images: OrderImage[]) => void) | undefined;
  onFiles?: ((files: File[]) => void) | undefined;
  max?: number | undefined;
}

export function ImageUploader({ images, defaultImages = [], onChange, onFiles, max = 12 }: ImageUploaderProps) {
  const [inner, setInner] = useState<OrderImage[]>(defaultImages);
  const list = images ?? inner;
  const set = (next: OrderImage[]) => {
    setInner(next);
    onChange?.(next);
  };
  const [over, setOver] = useState(false);
  const dragFrom = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const addFiles = (files: FileList | null) => {
    // SPEC-DEVIATION: lint prefer-string-starts-ends-with and restrict-plus-operands; same filter and ids.
    const picked = Array.from(files ?? [])
      .filter((f) => f.type.startsWith('image/'))
      .slice(0, max - list.length);
    if (!picked.length) return;
    onFiles?.(picked);
    set(
      list.concat(
        picked.map((f, i) => ({
          id: `up-${String(Date.now())}-${String(i)}`,
          name: f.name,
          src: URL.createObjectURL(f),
        })),
      ),
    );
  };
  const move = (from: number, to: number) => {
    if (from === to) return;
    const next = list.slice();
    const [m] = next.splice(from, 1);
    // SPEC-DEVIATION: noUncheckedIndexedAccess (TS2345). `from` is always a list index, so m is always defined.
    if (m === undefined) return;
    next.splice(to, 0, m);
    set(next);
  };
  const dropZoneRef = (zone: HTMLDivElement | null) => {
    if (zone === null) return;
    const onDragOver = (e: DragEvent) => {
      if (dragFrom.current == null) {
        e.preventDefault();
        setOver(true);
      }
    };
    const onDragLeave = () => {
      setOver(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setOver(false);
      if (dragFrom.current == null) addFiles(e.dataTransfer?.files ?? null);
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
  const thumbRef = (i: number) => (thumb: HTMLLIElement | null) => {
    if (thumb === null) return;
    const onDragStart = () => {
      dragFrom.current = i;
    };
    const onDragEnd = () => {
      dragFrom.current = null;
    };
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      if (dragFrom.current != null) move(dragFrom.current, i);
      dragFrom.current = null;
    };
    thumb.addEventListener('dragstart', onDragStart);
    thumb.addEventListener('dragend', onDragEnd);
    thumb.addEventListener('dragover', onDragOver);
    thumb.addEventListener('drop', onDrop);
    return () => {
      thumb.removeEventListener('dragstart', onDragStart);
      thumb.removeEventListener('dragend', onDragEnd);
      thumb.removeEventListener('dragover', onDragOver);
      thumb.removeEventListener('drop', onDrop);
    };
  };
  return (
    <div className={uploaderClasses}>
      <div ref={dropZoneRef} className={dropClasses} data-over={over}>
        <Icon name="cloud-upload" size={28} />
        <p className={dropTitleClasses}>
          {/* One text node, as in App. D.3: WebKit measures "…or" and " " as two runs 0.3px wider. */}
          {'Drag images here or '}
          <button
            type="button"
            className={linkButtonClasses}
            onClick={() => {
              inputRef.current?.click();
            }}
          >
            browse
          </button>
        </p>
        <p className={dropHintClasses}>
          JPG, PNG or WEBP · up to 10 MB each · {list.length}/{max}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files);
          }}
        />
      </div>
      {list.length > 0 && (
        <ul className={thumbsClasses} aria-label="Order images — drag to reorder; the first is the cover">
          {list.map((img, i) => (
            <li
              key={img.id}
              ref={thumbRef(i)}
              className={clsx(thumbClasses, i === 0 ? thumbRingClasses.cover : thumbRingClasses.plain)}
              draggable
            >
              {img.src ? (
                <img src={img.src} alt={img.name || `Order image ${String(i + 1)}`} className={thumbImageClasses} />
              ) : (
                <MediaPlaceholder label={false} number={img.number} ratio="1 / 1" className={thumbPlaceholderClasses} />
              )}
              {i === 0 && <span className={thumbCoverClasses}>Cover</span>}
              <span className={clsx(thumbGripClasses, thumbRevealClasses)} aria-hidden="true">
                <Icon name="grip-vertical" size={16} />
              </span>
              <div className={clsx(thumbActionsClasses, thumbRevealClasses)}>
                {i > 0 && (
                  <button
                    type="button"
                    className={thumbButtonClasses}
                    onClick={() => {
                      move(i, 0);
                    }}
                    aria-label="Make cover image"
                  >
                    <Icon name="star" size={14} />
                  </button>
                )}
                <button
                  type="button"
                  className={thumbButtonClasses}
                  onClick={() => {
                    set(list.filter((x) => x.id !== img.id));
                  }}
                  aria-label={`Remove ${img.name || 'image'}`}
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
