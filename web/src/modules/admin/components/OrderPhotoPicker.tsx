// The draft photo picker of the New Order form, F1 (ORD-04, D-09; UI-SPEC P2). Picked photos are prepared and checked in the browser
// (the same pick as the order page) and kept as drafts in memory with the form. Nothing is sent: after Save creates the order, the
// form hands the drafts to that order's upload queue. Staff can move, cover and remove drafts here with no request, and describe
// them in a window the page draws outside the form element, because the window has a form of its own and forms cannot nest.
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import {
  ImageUploader,
  MEDIA_COPY,
  type AddControlHandle,
  type PhotoTileModel,
  type PickError,
} from '@/components/media';
import { newIdempotencyKey } from '@/lib/forms/idempotencyKey';
import { PhotoDescriptionModal } from '@/modules/admin/components/PhotoDescriptionModal';
import { orderPhotosBodyClasses } from '@/modules/admin/components/orderPhotos.recipe';
import { imageRulesQuery, useImageRulesQuery } from '@/modules/admin/hooks/useImageRulesQuery';
import { ORDER_PHOTOS_COPY } from '@/modules/admin/orderPhotosCopy';
import {
  cleanFileName,
  pickFailureMessage,
  pickIssue,
  toImageRules,
  type ImageRules,
} from '@/modules/admin/orderPhotosSchemas';
import { prepareImage, type PrepareResult } from '@/utils/images';

const COPY = ORDER_PHOTOS_COPY;
const BYTES_PER_MEGABYTE = 1_048_576;
/** What the hint shows until the server's rules arrive; the pick itself always waits for the real rules. */
const DISPLAY_MAX = 5;
const DISPLAY_MEGABYTES = 10;

/** A photo picked on the form: prepared bytes and a data: preview, held in memory until the order exists. */
export interface DraftPhoto {
  id: string;
  blob: Blob;
  name: string;
  preview: string | null;
  previewUnavailable: boolean;
  /** Empty keeps the default text, "New order photo {n}", which follows the photo's place. */
  description: string;
}

export interface OrderPhotoPickerHandle {
  /** Resolves once every pick that is still being prepared has been added or refused. */
  settled: () => Promise<void>;
}

/**
 * The drafts of one form. `drafts` is what the screen draws; `read` is always the latest list, even between renders, so a pick
 * that runs across several awaits and the description window never work from a stale list. Every change goes through `update`.
 */
export interface DraftStore {
  readonly drafts: readonly DraftPhoto[];
  read: () => readonly DraftPhoto[];
  update: (change: (current: readonly DraftPhoto[]) => DraftPhoto[]) => void;
}

export function useDraftPhotos(initial: readonly DraftPhoto[] = []): DraftStore {
  const [drafts, setDrafts] = useState<readonly DraftPhoto[]>(initial);
  const latest = useRef<readonly DraftPhoto[]>(drafts);
  return {
    drafts,
    read: () => latest.current,
    update: (change) => {
      const next = change(latest.current);
      latest.current = next;
      setDrafts(next);
    },
  };
}

export interface OrderPhotoPickerProps {
  store: DraftStore;
  /** The edit-description press on a draft; the page opens the window. */
  onEditDescription?: ((id: string) => void) | undefined;
  handleRef?: Ref<OrderPhotoPickerHandle> | undefined;
}

export interface DraftDescriptionWindowProps {
  store: DraftStore;
  /** The draft being described; null keeps the window shut. */
  editingId: string | null;
  onClose: () => void;
}

/**
 * The description window of the draft being described (P5, draft mode). It sits next to the form, not in it. Saving puts the text
 * on the draft (empty keeps the default) and closes; nothing is sent.
 */
export function DraftDescriptionWindow({ store, editingId, onClose }: DraftDescriptionWindowProps) {
  const rulesState = useImageRulesQuery();
  const index = store.drafts.findIndex((candidate) => candidate.id === editingId);
  const draft = store.drafts[index];
  if (draft === undefined || rulesState.data === undefined) return null;
  const position = index + 1;
  return (
    <PhotoDescriptionModal
      key={draft.id}
      mode="draft"
      orderLabel=""
      position={position}
      total={store.drafts.length}
      initial={draft.description === '' ? COPY.defaultDescription.draft(position) : draft.description}
      maxLength={toImageRules(rulesState.data).descriptionMaxLength}
      onSave={(text) => {
        store.update((list) =>
          list.map((candidate) => (candidate.id === draft.id ? { ...candidate, description: text } : candidate)),
        );
        onClose();
      }}
      onClose={onClose}
    />
  );
}

/** A file that was accepted for a place and is still being prepared: its tile shows a Skeleton. */
interface PendingDraft {
  id: string;
  name: string;
}

function draftTile(draft: DraftPhoto, position: number): PhotoTileModel {
  return {
    id: draft.id,
    state: 'draft',
    description: draft.description === '' ? COPY.defaultDescription.draft(position) : draft.description,
    fileName: draft.name,
    preview: draft.preview ?? undefined,
    previewUnavailable: draft.previewUnavailable,
  };
}

function pendingTile(pending: PendingDraft, position: number): PhotoTileModel {
  return {
    id: pending.id,
    state: 'draft',
    description: COPY.defaultDescription.draft(position),
    fileName: pending.name,
    previewPending: true,
  };
}

/** Where focus goes once the list has changed: a named control, or the add area. */
type FocusTarget = { readonly label: string } | 'add';

export function OrderPhotoPicker({ store, onEditDescription, handleRef }: OrderPhotoPickerProps) {
  const value = store.drafts;
  const queryClient = useQueryClient();
  const rulesState = useImageRulesQuery();
  const rules = rulesState.data === undefined ? null : toImageRules(rulesState.data);
  const max = rules?.maxPerOrder ?? DISPLAY_MAX;
  const megabytes = rules === null ? DISPLAY_MEGABYTES : Number((rules.maxBytes / BYTES_PER_MEGABYTE).toFixed(1));
  const [pickErrors, setPickErrors] = useState<readonly PickError[]>([]);
  const [leftOut, setLeftOut] = useState(0);
  const [pending, setPending] = useState<readonly PendingDraft[]>([]);
  const [announcement, setAnnouncement] = useState('');
  const [focusTick, setFocusTick] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<AddControlHandle>(null);

  // The places held for photos still being prepared, as the last change left them.
  const pendingNow = useRef<readonly PendingDraft[]>([]);
  const picking = useRef<Promise<void>>(Promise.resolve());
  const focusTarget = useRef<FocusTarget | null>(null);

  useImperativeHandle(handleRef, () => ({
    settled: () => picking.current,
  }));

  // Focus is moved after the new list has been drawn.
  useEffect(() => {
    const target = focusTarget.current;
    if (focusTick === 0 || target === null) return;
    focusTarget.current = null;
    if (target === 'add') {
      addRef.current?.focus();
      return;
    }
    bodyRef.current?.querySelector<HTMLElement>(`[aria-label="${target.label}"]`)?.focus();
  }, [focusTick]);

  const setPendingNow = (next: readonly PendingDraft[]): void => {
    pendingNow.current = next;
    setPending(next);
  };

  const moveFocusTo = (target: FocusTarget): void => {
    focusTarget.current = target;
    setFocusTick((tick) => tick + 1);
  };

  const runPick = async (files: File[]): Promise<void> => {
    let current: ImageRules;
    try {
      current = toImageRules(await queryClient.query(imageRulesQuery));
    } catch {
      setPickErrors(
        files.map((file) => ({ fileName: cleanFileName(file.name), reason: COPY.reasons.rulesUnavailable })),
      );
      setLeftOut(0);
      return;
    }
    const refused: PickError[] = [];
    let leftOutCount = 0;
    for (const file of files) {
      if (store.read().length + pendingNow.current.length >= current.maxPerOrder) {
        leftOutCount += 1;
        continue;
      }
      const fileName = cleanFileName(file.name);
      const place: PendingDraft = { id: newIdempotencyKey(), name: file.name };
      // The place is held while the photo is prepared, so the tile shows a Skeleton and the count is right.
      setPendingNow([...pendingNow.current, place]);
      let prepared: PrepareResult;
      try {
        prepared = await prepareImage(file, current);
      } catch {
        prepared = { ok: false, reason: 'unreadable' };
      }
      setPendingNow(pendingNow.current.filter((candidate) => candidate.id !== place.id));
      if (!prepared.ok) {
        refused.push({ fileName, reason: pickFailureMessage(prepared.reason, file.name, current) });
        continue;
      }
      const issue = pickIssue(current, {
        name: file.name,
        type: prepared.type,
        bytes: prepared.file.size,
        width: prepared.width,
        height: prepared.height,
      });
      if (issue !== null) {
        refused.push({ fileName, reason: issue });
        continue;
      }
      const draft: DraftPhoto = {
        id: place.id,
        blob: prepared.file,
        name: prepared.name,
        preview: prepared.preview,
        previewUnavailable: prepared.previewUnavailable,
        description: '',
      };
      store.update((list) => [...list, draft]);
    }
    setPickErrors(refused);
    setLeftOut(leftOutCount);
  };

  const addFiles = (files: File[]): void => {
    picking.current = picking.current.then(() => runPick(files));
  };

  /** Moves the draft to the 0-based place `toIndex`; place 1 is the cover. */
  const move = (id: string, toIndex: number): void => {
    const list = store.read();
    const from = list.findIndex((draft) => draft.id === id);
    const draft = list[from];
    const to = Math.min(Math.max(toIndex, 0), list.length - 1);
    if (draft === undefined || to === from) return;
    const next = list.filter((candidate) => candidate.id !== id);
    next.splice(to, 0, draft);
    store.update(() => next);
    setAnnouncement(to === 0 ? COPY.announce.movedCover(next.length) : COPY.announce.moved(to + 1, next.length));
  };

  const makeCover = (id: string): void => {
    move(id, 0);
    moveFocusTo({ label: MEDIA_COPY.tile.editDescription(1) });
  };

  const remove = (id: string): void => {
    const list = store.read();
    const next = list.filter((draft) => draft.id !== id);
    if (next.length === list.length) return;
    store.update(() => next);
    setAnnouncement(COPY.announce.deleted(next.length));
    moveFocusTo('add');
  };

  const photos = [
    ...value.map((draft, index) => draftTile(draft, index + 1)),
    ...pending.map((place, index) => pendingTile(place, value.length + index + 1)),
  ];

  return (
    <div ref={bodyRef} className={orderPhotosBodyClasses}>
      <ImageUploader
        photos={photos}
        max={max}
        maxMegabytes={megabytes}
        mode="draft"
        busy={pending.length > 0}
        limitNote={COPY.limit.draft(max)}
        pickErrors={pickErrors}
        leftOutCount={leftOut}
        addControlRef={addRef}
        onAddFiles={addFiles}
        onMove={move}
        onMakeCover={makeCover}
        onEditDescription={(id) => {
          onEditDescription?.(id);
        }}
        onDelete={remove}
        onRemove={remove}
        onRetry={() => undefined}
        onOpen={() => undefined}
      />
      <div aria-live="polite" className={srOnlyClasses}>
        {announcement}
      </div>
    </div>
  );
}
