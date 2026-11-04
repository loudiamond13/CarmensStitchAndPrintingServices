// The photo description window (UI-SPEC P5; D-12, D-30, OR-3, 08 D-58; plan 09-21). One field, Cancel and Save Description, on the
// shared order window frame, so a changed field asks "Discard changes?" before it closes. The text is checked in the browser with
// the server's limit before anything is handed on. Saving an empty field, or the exact default text, hands on "" (no description):
// the default is never stored, so it follows the photo's place. The window renders a form of its own, so the page must draw it
// outside any other form. In `draft` mode the caller keeps the text on the form; `live` saves are added with plan 09-27.
import { useState } from 'react';
import { Field } from '@/components/forms';
import { OrderWindow } from '@/modules/admin/components/OrderWindow';
import type { OrderWindowBanner } from '@/modules/admin/hooks/useOrderChildSave';
import { ORDER_PHOTOS_COPY } from '@/modules/admin/orderPhotosCopy';
import { descriptionSchema, type ImageRules } from '@/modules/admin/orderPhotosSchemas';

const COPY = ORDER_PHOTOS_COPY.description;
const FIELD_ROWS = 3;

/** The description check reads only the length limit; the other rules are not used here. */
const OTHER_RULES: Omit<ImageRules, 'descriptionMaxLength'> = {
  maxPerOrder: 0,
  maxBytes: 0,
  maxPixels: 0,
  maxSide: 0,
  types: [],
};

export interface PhotoDescriptionModalProps {
  /** False plays the close animation and then renders nothing. Default true. */
  open?: boolean | undefined;
  /** `draft`: a photo on the New Order form. `live`: a saved photo of an order. */
  mode: 'draft' | 'live';
  /** The order number, for a saved photo. Not used for a draft. */
  orderLabel: string;
  /** The photo's 1-based place and how many photos there are. */
  position: number;
  total: number;
  /** The text shown now: the description, or the default text. */
  initial: string;
  /** The server's description limit. */
  maxLength: number;
  /** Receives the checked text, or "" for no description. May return a promise: the button shows Saving until it settles. */
  onSave: (text: string) => void | Promise<void>;
  onClose: () => void;
  banner?: OrderWindowBanner | null | undefined;
}

/** Puts the cursor in the field with the text selected, once the window's form is on screen. */
function selectDescription(form: HTMLFormElement | null): void {
  const box = form?.querySelector('textarea');
  box?.focus();
  box?.select();
}

export function PhotoDescriptionModal({
  open = true,
  mode,
  orderLabel,
  position,
  total,
  initial,
  maxLength,
  onSave,
  onClose,
  banner = null,
}: PhotoDescriptionModalProps) {
  const [text, setText] = useState(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const defaultText =
    mode === 'draft'
      ? ORDER_PHOTOS_COPY.defaultDescription.draft(position)
      : ORDER_PHOTOS_COPY.defaultDescription.saved(orderLabel, position);

  const save = async (): Promise<void> => {
    if (saving) return;
    const checked = descriptionSchema({ ...OTHER_RULES, descriptionMaxLength: maxLength }).safeParse(text);
    if (!checked.success) {
      setError(checked.error.issues[0]?.message ?? '');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await onSave(checked.data === defaultText ? '' : checked.data);
    } catch {
      // The caller shows its own failure; the window stays open with the typed text.
    } finally {
      setSaving(false);
    }
  };

  return (
    <OrderWindow
      title={COPY.title}
      description={mode === 'draft' ? COPY.forNewOrder(position, total) : COPY.forOrder(orderLabel, position, total)}
      open={open}
      isDirty={text !== initial}
      pending={saving}
      banner={banner}
      saveLabel={COPY.save}
      saveBlocked={banner?.kind === 'removed'}
      onSave={() => {
        void save();
      }}
      onClose={onClose}
      formRef={selectDescription}
    >
      <Field
        multiline
        rows={FIELD_ROWS}
        name="description"
        label={COPY.label}
        hint={COPY.hint}
        value={text}
        error={error}
        onChange={(event) => {
          setText(event.target.value);
          setError('');
        }}
      />
    </OrderWindow>
  );
}
