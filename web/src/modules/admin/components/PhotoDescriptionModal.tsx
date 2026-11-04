// The photo description window (UI-SPEC P5; D-12, D-15, D-30, OR-3, 08 D-58; plans 09-21 and 09-27). One field, Cancel and Save
// Description, on the shared order window frame, so a changed field asks "Discard changes?" before it closes. The text is checked in
// the browser with the server's limit before anything is handed on. Saving an empty field, or the exact default text, sends "" (no
// description): the default is never stored, so it follows the photo's place. The window renders a form of its own, so the page
// must draw it outside any other form.
// `draft`: a photo of the New Order form; the caller keeps the text. `live`: a saved photo; the window saves it itself with the order
// version it opened with, shows a stale save as the ConflictBanner (Load Latest puts the latest description in the field), and
// blocks Save when the photo is gone (404) or the order is locked (422).
import { useEffect, useRef, useState } from 'react';
import { Field } from '@/components/forms';
import { isHttpError } from '@/core/api/errors';
import { OrderWindow } from '@/modules/admin/components/OrderWindow';
import { useRefetchOrder } from '@/modules/admin/hooks/useApplyOrder';
import { useOrderChildSave, type OrderWindowBanner } from '@/modules/admin/hooks/useOrderChildSave';
import { orderedImages } from '@/modules/admin/orderPhotoList';
import { ORDER_PHOTOS_COPY } from '@/modules/admin/orderPhotosCopy';
import { descriptionSchema, type ImageRules } from '@/modules/admin/orderPhotosSchemas';
import { orderPhotosService } from '@/modules/admin/services/orderPhotosService';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';

const COPY = ORDER_PHOTOS_COPY.description;
const FIELD_ROWS = 3;
const STALE_STATUS = 409;

/** The description check reads only the length limit; the other rules are not used here. */
const OTHER_RULES: Omit<ImageRules, 'descriptionMaxLength'> = {
  maxPerOrder: 0,
  maxBytes: 0,
  maxPixels: 0,
  maxSide: 0,
  types: [],
};

interface CommonProps {
  /** False plays the close animation and then renders nothing. Default true. */
  open?: boolean | undefined;
  /** The order number, for a saved photo. Not used for a draft. */
  orderLabel: string;
  /** The photo's 1-based place and how many photos there are, as the window opens. */
  position: number;
  total: number;
  /** The text shown now: the description, or the default text. */
  initial: string;
  /** The server's description limit. */
  maxLength: number;
  onClose: () => void;
}

/** A photo on the New Order form: the caller keeps the text. */
export interface DraftDescriptionProps extends CommonProps {
  mode: 'draft';
  /** Receives the checked text, or "" for no description. May return a promise: the button shows Saving until it settles. */
  onSave: (text: string) => void | Promise<void>;
}

/** A saved photo of an order: the window saves it. */
export interface LiveDescriptionProps extends CommonProps {
  mode: 'live';
  /** The order as the page showed it when the window opened: the save sends its version. */
  order: OrderDetailResponse;
  imageId: string;
  /** The save succeeded and the page already holds the answer. */
  onSaved: (order: OrderDetailResponse) => void;
}

export type PhotoDescriptionModalProps = DraftDescriptionProps | LiveDescriptionProps;

/** What one live save carries: the checked text ("" for none) and the order version the window opened with. */
interface DescriptionSave {
  text: string;
  version: string;
}

/** Text that replaces the field (Load Latest); a new `key` is a new replacement. */
interface Replacement {
  text: string;
  key: number;
}

export function PhotoDescriptionModal(props: PhotoDescriptionModalProps) {
  return props.mode === 'live' ? <LiveDescription {...props} /> : <DraftDescription {...props} />;
}

function DraftDescription({ open, position, total, initial, maxLength, onClose, onSave }: DraftDescriptionProps) {
  return (
    <DescriptionWindow
      open={open}
      description={COPY.forNewOrder(position, total)}
      initial={initial}
      defaultText={ORDER_PHOTOS_COPY.defaultDescription.draft(position)}
      maxLength={maxLength}
      onSubmit={onSave}
      onClose={onClose}
    />
  );
}

function LiveDescription({
  open,
  orderLabel,
  position,
  total,
  initial,
  maxLength,
  onClose,
  order,
  imageId,
  onSaved,
}: LiveDescriptionProps) {
  const refetchOrder = useRefetchOrder();
  const [place, setPlace] = useState({ position, total });
  // The order the window opened with, or Load Latest brought: a save sends this order's version, whatever a refetch brings.
  const [opened, setOpened] = useState(order);
  const [replacement, setReplacement] = useState<Replacement | null>(null);

  // Load Latest: the photo's latest place and text replace what the window shows. False when the photo is gone.
  const takeLatest = (latest: OrderDetailResponse): boolean => {
    const places = orderedImages(latest);
    const at = places.findIndex((candidate) => candidate.image.id === imageId);
    const found = places[at];
    if (found === undefined) {
      return false;
    }
    setOpened(latest);
    setPlace({ position: at + 1, total: places.length });
    setReplacement((current) => ({ text: found.description, key: (current?.key ?? 0) + 1 }));
    return true;
  };

  const save = useOrderChildSave<DescriptionSave>({
    orderId: order.id,
    thing: 'photo',
    verb: 'updated',
    quiet: true,
    send: async (_key, data) => {
      try {
        return await orderPhotosService.describe(order.id, imageId, data.text, data.version);
      } catch (failure: unknown) {
        if (isHttpError(failure) && failure.status === STALE_STATUS) {
          // The photos behind the window are out of date as well.
          void refetchOrder(order.id);
        }
        throw failure;
      }
    },
    onSaved,
    onLatest: takeLatest,
  });

  return (
    <DescriptionWindow
      open={open}
      description={COPY.forOrder(orderLabel, place.position, place.total)}
      initial={initial}
      defaultText={ORDER_PHOTOS_COPY.defaultDescription.saved(orderLabel, place.position)}
      maxLength={maxLength}
      pending={save.pending}
      banner={save.banner}
      saveBlocked={save.saveBlocked}
      loadingLatest={save.loadingLatest}
      onLoadLatest={() => {
        void save.loadLatest();
      }}
      status={save.status}
      replacement={replacement}
      onSubmit={(text) => {
        save.submit({ text, version: opened.version });
      }}
      onClose={onClose}
    />
  );
}

interface DescriptionWindowProps {
  open: boolean | undefined;
  description: string;
  initial: string;
  defaultText: string;
  maxLength: number;
  pending?: boolean | undefined;
  banner?: OrderWindowBanner | null | undefined;
  saveBlocked?: boolean | undefined;
  loadingLatest?: boolean | undefined;
  onLoadLatest?: (() => void) | undefined;
  status?: string | undefined;
  replacement?: Replacement | null | undefined;
  /** Receives the checked text, or "" for no description. May return a promise: the button shows Saving until it settles. */
  onSubmit: (text: string) => void | Promise<void>;
  onClose: () => void;
}

/** Puts the cursor in the field with the text selected (also the window form's ref, once the form is on screen). */
function selectField(scope: ParentNode | null): void {
  const box = scope?.querySelector('textarea');
  box?.focus();
  box?.select();
}

function DescriptionWindow({
  open,
  description,
  initial,
  defaultText,
  maxLength,
  pending = false,
  banner = null,
  saveBlocked = false,
  loadingLatest = false,
  onLoadLatest,
  status = '',
  replacement = null,
  onSubmit,
  onClose,
}: DescriptionWindowProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(initial);
  // The text the field opened with (or Load Latest brought): the window is dirty when the field differs from it.
  const [baseline, setBaseline] = useState(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [replaced, setReplaced] = useState(0);
  // Adjusted while rendering: a new replacement puts its text in the field.
  if (replacement !== null && replacement.key !== replaced) {
    setReplaced(replacement.key);
    setText(replacement.text);
    setBaseline(replacement.text);
    setError('');
  }
  const replacedKey = replacement?.key ?? 0;
  useEffect(() => {
    if (replacedKey > 0) {
      selectField(bodyRef.current);
    }
  }, [replacedKey]);

  const busy = pending || saving;

  const save = async (): Promise<void> => {
    if (busy || saveBlocked) return;
    const checked = descriptionSchema({ ...OTHER_RULES, descriptionMaxLength: maxLength }).safeParse(text);
    if (!checked.success) {
      setError(checked.error.issues[0]?.message ?? '');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await onSubmit(checked.data === defaultText ? '' : checked.data);
    } catch {
      // The caller shows its own failure; the window stays open with the typed text.
    } finally {
      setSaving(false);
    }
  };

  return (
    <OrderWindow
      title={COPY.title}
      description={description}
      open={open}
      isDirty={text !== baseline}
      pending={busy}
      banner={banner}
      loadingLatest={loadingLatest}
      onLoadLatest={onLoadLatest}
      status={status}
      saveLabel={COPY.save}
      saveBlocked={saveBlocked}
      onSave={() => {
        void save();
      }}
      onClose={onClose}
      formRef={selectField}
    >
      <div ref={bodyRef}>
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
      </div>
    </OrderWindow>
  );
}
