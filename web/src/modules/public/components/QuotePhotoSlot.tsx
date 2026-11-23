// The photo area of the quote form (UI-SPEC Q2, D-43). Before the first tap it is a label and one Choose Photos button that opens the
// file chooser at once. The picker, its checks and the upload code load as one piece while the visitor chooses; the chosen files are
// checked by that piece, then the picker lists them. Until then the form's handle waits for that check (review W5 CR-01).
import { useId, useImperativeHandle, useRef, useState, type ChangeEvent, type Ref } from 'react';
import { Button } from '@/components/actions/Button';
import { PUBLIC_COPY } from '../copy';
import type { QuotePhotoLimits } from '../hooks/useQuoteTicket';
import type { FirstPick } from '../quotePhotoKit';
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

interface Loaded extends FirstPick {
  kit: QuotePhotoKit;
}

export function QuotePhotoSlot({ photos, onChange, disabled, limits, handleRef }: QuotePhotoSlotProps) {
  const labelId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  // Loading: the photo piece is loading and checking the first pick, and Choose Photos shows a spinner and takes no second pick.
  const [status, setStatus] = useState<'idle' | 'loading' | 'failed'>('idle');
  const picker = useRef<QuotePhotoPickerHandle>(null);
  // The first pick while the photo piece loads and checks it: the photos it added, or none when the piece did not load.
  const first = useRef<Promise<readonly File[]>>(undefined);

  useImperativeHandle(handleRef, () => ({
    clearErrors: () => {
      picker.current?.clearErrors();
    },
    settled: async () => (await picker.current?.settled()) ?? (await first.current) ?? photos,
  }));

  if (loaded !== null) {
    return (
      <loaded.kit.QuotePhotoPicker
        photos={photos}
        onChange={onChange}
        disabled={disabled}
        rules={loaded.rules}
        firstErrors={loaded.errors}
        handleRef={picker}
      />
    );
  }

  const choose = (event: ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) {
      return;
    }
    setStatus('loading');
    first.current = Promise.all([loadQuotePhotoKit(), limits()])
      .then(async ([kit, rules]) => {
        const pick = await kit.firstPick(files, rules);
        setLoaded({ kit, ...pick });
        onChange(pick.photos);
        return pick.photos;
      })
      .catch(() => {
        setStatus('failed');
        return [];
      });
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
          pending={status === 'loading'}
          onClick={() => {
            input.current?.click();
          }}
        >
          {COPY.choosePhotos}
        </Button>
      </div>
      <p className={photoCountClasses}>{COPY.hint('10 MB', 5)}</p>
      {status === 'failed' && (
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
