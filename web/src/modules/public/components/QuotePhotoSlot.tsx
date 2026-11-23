// The photo area of the quote form (UI-SPEC Q2, D-43). Before the first tap it is a label and one Choose Photos button that opens the
// file chooser at once. The picker, its checks and the upload code load as one piece while the visitor chooses; the chosen files are
// handed to the picker, which checks and lists them.
import { useId, useRef, useState, type ChangeEvent, type Ref } from 'react';
import { Button } from '@/components/actions/Button';
import { PUBLIC_COPY } from '../copy';
import type { QuotePhotoLimits } from '../hooks/useQuoteTicket';
import type { QuotePhotoPickerHandle } from './QuotePhotoPicker';
import { loadQuotePhotoKit, type QuotePhotoKit } from './lazyQuotePhotoKit';
import {
  photoCountClasses,
  photoLabelClasses,
  photoLabelRowClasses,
  photoOptionalClasses,
  photoPickerClasses,
} from './quoteForm.recipe';

const COPY = PUBLIC_COPY.contact.photos;

export interface QuotePhotoSlotProps {
  photos: readonly File[];
  onChange: (photos: File[]) => void;
  /** The form is sending. */
  disabled: boolean;
  /** The photo limits of the form's ticket, once it is read; the built-in ones when it could not be. */
  limits: () => Promise<QuotePhotoLimits | undefined>;
  handleRef?: Ref<QuotePhotoPickerHandle> | undefined;
}

interface Loaded {
  kit: QuotePhotoKit;
  limits: QuotePhotoLimits | undefined;
  firstPick: File[];
}

export function QuotePhotoSlot({ photos, onChange, disabled, limits, handleRef }: QuotePhotoSlotProps) {
  const labelId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);

  if (loaded !== null) {
    const { QuotePhotoPicker, pickerRules } = loaded.kit;
    return (
      <QuotePhotoPicker
        photos={photos}
        onChange={onChange}
        disabled={disabled}
        rules={pickerRules(loaded.limits)}
        firstPick={loaded.firstPick}
        handleRef={handleRef}
      />
    );
  }

  const choose = (event: ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) {
      return;
    }
    setFailed(false);
    void Promise.all([loadQuotePhotoKit(), limits()]).then(
      ([kit, rules]) => {
        setLoaded({ kit, limits: rules, firstPick: files });
      },
      () => {
        setFailed(true);
      },
    );
  };

  return (
    <div role="group" aria-labelledby={labelId} className={photoPickerClasses}>
      <p id={labelId} className={photoLabelRowClasses}>
        <span className={photoLabelClasses}>{COPY.label}</span>
        <span className={photoOptionalClasses}>{COPY.optional}</span>
      </p>
      <div>
        <Button
          variant="secondary"
          icon="image"
          aria-disabled={disabled}
          onClick={() => {
            if (!disabled) input.current?.click();
          }}
        >
          {COPY.choosePhotos}
        </Button>
      </div>
      <p className={photoCountClasses}>{COPY.hint('10 MB', 5)}</p>
      {failed && (
        <p role="alert" className={photoCountClasses}>
          {PUBLIC_COPY.contact.formLoadFailed.body}
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        hidden
        onChange={choose}
      />
    </div>
  );
}
