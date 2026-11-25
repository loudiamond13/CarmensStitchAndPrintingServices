// SPEC-GAP: quote photo picker (UI-SPEC Q2; plan 13-02; INQ-02, D-01, D-02, D-05, D-06). A visitor picks up to 5 photos, sees each
// one and can remove any. The files are handed on exactly as picked: never shrunk, redrawn or converted. The preview is only for
// the screen, drawn one file at a time as a `data:` URL (the strict CSP has no `blob:`).
//
// SPEC-DEVIATION: PHOTO-LIST a small public picker, not ImageUploader: one plain row per photo, with no cover, no reorder, no
// description and no upload queue.
// SPEC-DEVIATION: UI-WR-11 each input is emptied after a pick, so a browser fires a change for the same file again.
// SPEC-DEVIATION: jsx-a11y no-static-element-interactions the drop zone's drag handlers are native listeners attached through a
// callback ref (React 19 ref cleanup), the same events and the same DOM.
import { useEffect, useId, useImperativeHandle, useRef, useState, type ChangeEvent, type Ref } from 'react';
import { Button } from '@/components/actions/Button';
import { Icon } from '@/components/brand/Icon';
import { Skeleton } from '@/components/feedback/Skeleton';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import {
  dropClasses,
  dropHintClasses,
  dropTitleClasses,
  linkButtonClasses,
  pickErrorBodyClasses,
  pickErrorClasses,
  pickErrorIconClasses,
  pickErrorListClasses,
  pickErrorReasonClasses,
  touchAddClasses,
  touchButtonClasses,
  touchHintClasses,
  touchRowClasses,
} from '@/components/media/media.recipe';
import { Note } from '@/components/states/Note';
import { PUBLIC_COPY } from '@/modules/public/copy';
import { checkQuotePhotos, QUOTE_PHOTO_RULES, sameFile, type QuotePhotoRules } from '@/modules/public/quotePhotos';
import { cleanFileName, fileSizeText, previewImage, sizeText } from '@/utils/images';
import {
  photoCountClasses,
  photoInfoClasses,
  photoLabelClasses,
  photoLabelRowClasses,
  photoNameClasses,
  photoNoPreviewClasses,
  photoOptionalClasses,
  photoPickerClasses,
  photoRowClasses,
  photoRowsClasses,
  photoSizeClasses,
  photoThumbClasses,
  photoThumbImageClasses,
} from './quoteForm.recipe';

const COPY = PUBLIC_COPY.contact.photos;

export interface QuotePhotoPickerProps {
  /** The photos picked so far, as the visitor picked them. */
  photos: readonly File[];
  onChange: (photos: File[]) => void;
  rules?: QuotePhotoRules;
  /** The form is sending: every control keeps focus but ignores a press. */
  disabled?: boolean;
  handleRef?: Ref<QuotePhotoPickerHandle> | undefined;
  /** The refusals of the files chosen before this picker was loaded, shown when it shows. */
  firstErrors?: PickErrors | undefined;
}

export interface QuotePhotoPickerHandle {
  /** The form calls this on submit: the pick-error box goes away. */
  clearErrors: () => void;
  /** Resolves with the photos once every pick still being checked is in, so Send never leaves one out (review W5 CR-01). */
  settled: () => Promise<readonly File[]>;
}

/** Where focus goes once the list has changed: a row's Remove, or the add control. */
type FocusTarget = File | 'add';

/** The last pick's refusals: one line per refused file, then the count line. */
export interface PickErrors {
  refusals: readonly string[];
  countLine: string | null;
}

const NO_ERRORS: PickErrors = { refusals: [], countLine: null };

export function QuotePhotoPicker({
  photos,
  onChange,
  rules = QUOTE_PHOTO_RULES,
  disabled = false,
  handleRef,
  firstErrors = NO_ERRORS,
}: QuotePhotoPickerProps) {
  const labelId = useId();
  const [over, setOver] = useState(false);
  const [errors, setErrors] = useState<PickErrors>(firstErrors);
  const latest = useRef(photos);
  // A missing entry is a preview still being drawn; null is a photo the browser cannot draw.
  const [previews, setPreviews] = useState<ReadonlyMap<File, string | null>>(new Map());
  const [focusTick, setFocusTick] = useState(0);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const browseRef = useRef<HTMLButtonElement>(null);
  const chooseRef = useRef<HTMLButtonElement>(null);
  const removeRefs = useRef(new Map<File, HTMLButtonElement>());
  const focusTarget = useRef<FocusTarget | null>(null);
  const drawing = useRef<File | null>(null);
  // Picks run one after the other, so each one counts the photos the one before it added (review W1 IN-05).
  const queue = useRef<Promise<void>>(Promise.resolve());
  const atLimit = photos.length >= rules.maxPhotos;

  // One preview at a time, and never for a file over the size limit.
  useEffect(() => {
    if (drawing.current !== null) return;
    const next = photos.find((file) => !previews.has(file));
    if (next === undefined) return;
    drawing.current = next;
    const drawn = next.size > rules.maxBytes ? Promise.resolve(null) : previewImage(next);
    void drawn
      .catch(() => null)
      .then((url) => {
        drawing.current = null;
        // A photo removed while it was drawn keeps no preview, but the state still changes so the next photo is drawn.
        setPreviews((current) => {
          const kept = new Map(current);
          if (latest.current.includes(next)) kept.set(next, url);
          return kept;
        });
      });
  }, [photos, previews, rules.maxBytes]);

  // Focus moves after the new list has been drawn.
  useEffect(() => {
    const target = focusTarget.current;
    if (focusTick === 0 || target === null) return;
    focusTarget.current = null;
    if (target === 'add') {
      const shown = [chooseRef.current, browseRef.current].find(
        (control) => (control?.getClientRects().length ?? 0) > 0,
      );
      (shown ?? browseRef.current)?.focus();
      return;
    }
    removeRefs.current.get(target)?.focus();
  }, [focusTick]);

  useImperativeHandle(handleRef, () => ({
    clearErrors: () => {
      setErrors(NO_ERRORS);
    },
    settled: () =>
      queue.current.then(
        () => latest.current,
        () => latest.current,
      ),
  }));

  // The list a pick that is still being checked must add to, even if a Remove ran meanwhile.
  useEffect(() => {
    latest.current = photos;
  }, [photos]);

  const addNow = async (files: File[]): Promise<void> => {
    setErrors(NO_ERRORS);
    // The same photo picked again is the same photo: it is added once, without a notice.
    const fresh: File[] = [];
    for (const file of files) {
      if (![...latest.current, ...fresh].some((known) => sameFile(known, file))) fresh.push(file);
    }
    if (fresh.length === 0) return;
    const result = await checkQuotePhotos(fresh, latest.current.length, rules);
    setErrors({ refusals: result.refusals, countLine: result.countLine });
    if (result.accepted.length > 0) {
      const merged = [...latest.current, ...result.accepted].slice(0, rules.maxPhotos);
      latest.current = merged;
      onChange(merged);
    }
  };

  const addFiles = (files: File[]): Promise<void> => {
    if (files.length === 0) return Promise.resolve();
    // The send has already taken its photos, so a late pick is refused out loud instead of being lost.
    if (disabled) {
      setErrors({ refusals: [], countLine: COPY.whileSending });
      return Promise.resolve();
    }
    queue.current = queue.current.then(() => addNow(files));
    return queue.current;
  };

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    void addFiles(files);
  };

  const remove = (index: number): void => {
    if (disabled) return;
    const next = photos.filter((_, position) => position !== index);
    const neighbour = photos[index + 1] ?? photos[index - 1];
    setPreviews((current) => {
      const kept = new Map<File, string | null>();
      for (const file of next) {
        const url = current.get(file);
        if (url !== undefined) kept.set(file, url);
      }
      return kept;
    });
    focusTarget.current = neighbour ?? 'add';
    setFocusTick((tick) => tick + 1);
    latest.current = next;
    onChange(next);
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
      void addFiles(Array.from(event.dataTransfer?.files ?? []));
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

  const hint = COPY.hint(sizeText(rules.maxBytes), rules.maxPhotos);

  return (
    <div role="group" aria-labelledby={labelId} className={photoPickerClasses}>
      <p id={labelId} className={photoLabelRowClasses}>
        <span className={photoLabelClasses}>{COPY.label}</span>
        <span className={photoOptionalClasses}>{COPY.optional}</span>
      </p>
      {(errors.refusals.length > 0 || errors.countLine !== null) && (
        <div className={pickErrorClasses} role="alert">
          <span className={pickErrorIconClasses}>
            <Icon name="triangle-alert" size={16} />
          </span>
          <div className={pickErrorBodyClasses}>
            {errors.refusals.length > 0 && (
              <ul className={pickErrorListClasses}>
                {errors.refusals.map((line, index) => (
                  // The same name can be refused twice, so a line has no id of its own.
                  <li key={`${String(index)}-${line}`} className={pickErrorReasonClasses}>
                    {line}
                  </li>
                ))}
              </ul>
            )}
            {errors.countLine !== null && <p className={pickErrorReasonClasses}>{errors.countLine}</p>}
          </div>
        </div>
      )}
      {atLimit ? (
        <Note icon="info">{COPY.limit(rules.maxPhotos)}</Note>
      ) : (
        <>
          <div ref={dropZoneRef} className={dropClasses} data-over={over}>
            <Icon name="cloud-upload" size={28} />
            <p className={dropTitleClasses}>
              {COPY.dropTitle}
              <button
                ref={browseRef}
                type="button"
                className={linkButtonClasses}
                aria-disabled={disabled || undefined}
                onClick={() => {
                  if (!disabled) galleryRef.current?.click();
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
                aria-disabled={disabled}
                onClick={() => {
                  cameraRef.current?.click();
                }}
              >
                {COPY.takePhoto}
              </Button>
              <Button
                ref={chooseRef}
                variant="secondary"
                icon="image"
                className={touchButtonClasses}
                aria-disabled={disabled}
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
            onChange={pick}
          />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
        </>
      )}
      {photos.length > 0 && (
        <>
          <ul className={photoRowsClasses} aria-label={COPY.listName}>
            {photos.map((file, index) => {
              const name = cleanFileName(file.name);
              const preview = previews.get(file);
              return (
                <li key={`${String(index)}-${file.name}`} className={photoRowClasses}>
                  <div className={photoThumbClasses}>
                    {preview === undefined ? (
                      <Skeleton width={64} height={64} radius={0} />
                    ) : preview === null ? (
                      <span className={photoNoPreviewClasses}>
                        <Icon name="image" size={24} />
                        <span className={srOnlyClasses}>{COPY.noPreview}</span>
                      </span>
                    ) : (
                      <img src={preview} alt="" className={photoThumbImageClasses} />
                    )}
                  </div>
                  <div className={photoInfoClasses}>
                    <span className={photoNameClasses}>{name}</span>
                    <span className={photoSizeClasses}>{fileSizeText(file.size)}</span>
                  </div>
                  <Button
                    variant="ghost"
                    icon="x"
                    aria-label={COPY.remove(name)}
                    aria-disabled={disabled}
                    ref={(button) => {
                      if (button === null) removeRefs.current.delete(file);
                      else removeRefs.current.set(file, button);
                    }}
                    onClick={() => {
                      remove(index);
                    }}
                  />
                </li>
              );
            })}
          </ul>
          <p className={photoCountClasses}>{COPY.count(photos.length, rules.maxPhotos)}</p>
        </>
      )}
    </div>
  );
}
