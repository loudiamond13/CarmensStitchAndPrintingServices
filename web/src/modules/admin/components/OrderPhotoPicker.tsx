// The draft photo picker of the New Order form, F1 (ORD-04, D-09; UI-SPEC P2). Picked photos are prepared and checked in the browser
// (the same pick as the order page) and kept as drafts in memory with the form. Nothing is sent: after Save creates the order, the
// form hands the drafts to that order's upload queue. The description window is drawn by the page, outside the form element,
// because the window has a form of its own and forms cannot nest.
import { useQueryClient } from '@tanstack/react-query';
import { useImperativeHandle, useRef, useState, type Ref } from 'react';
import { ImageUploader, type PhotoTileModel, type PickError } from '@/components/media';
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
import { newIdempotencyKey } from '@/lib/forms/idempotencyKey';
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

export interface OrderPhotoPickerProps {
  value: readonly DraftPhoto[];
  onChange: (next: DraftPhoto[]) => void;
  /** The edit-description press on a draft; the page opens the window. */
  onEditDescription?: ((id: string) => void) | undefined;
  handleRef?: Ref<OrderPhotoPickerHandle> | undefined;
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

export function OrderPhotoPicker({ value, onChange, onEditDescription, handleRef }: OrderPhotoPickerProps) {
  const queryClient = useQueryClient();
  const rulesState = useImageRulesQuery();
  const rules = rulesState.data === undefined ? null : toImageRules(rulesState.data);
  const max = rules?.maxPerOrder ?? DISPLAY_MAX;
  const megabytes = rules === null ? DISPLAY_MEGABYTES : Number((rules.maxBytes / BYTES_PER_MEGABYTE).toFixed(1));
  const [pickErrors, setPickErrors] = useState<readonly PickError[]>([]);
  const [leftOut, setLeftOut] = useState(0);

  // The drafts as the last pick left them, so a pick that waits on an earlier one adds to the right list.
  const latest = useRef<readonly DraftPhoto[]>(value);
  const picking = useRef<Promise<void>>(Promise.resolve());

  useImperativeHandle(handleRef, () => ({
    settled: () => picking.current,
  }));

  const emit = (next: DraftPhoto[]): void => {
    latest.current = next;
    onChange(next);
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
    for (const file of files) {
      const fileName = cleanFileName(file.name);
      let prepared: PrepareResult;
      try {
        prepared = await prepareImage(file, current);
      } catch {
        prepared = { ok: false, reason: 'unreadable' };
      }
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
      emit([
        ...latest.current,
        {
          id: newIdempotencyKey(),
          blob: prepared.file,
          name: prepared.name,
          preview: prepared.preview,
          previewUnavailable: prepared.previewUnavailable,
          description: '',
        },
      ]);
    }
    setPickErrors(refused);
    setLeftOut(0);
  };

  const addFiles = (files: File[]): void => {
    picking.current = picking.current.then(() => runPick(files));
  };

  const photos = value.map((draft, index) => draftTile(draft, index + 1));

  return (
    <div className={orderPhotosBodyClasses}>
      <ImageUploader
        photos={photos}
        max={max}
        maxMegabytes={megabytes}
        mode="draft"
        busy={false}
        limitNote={COPY.limit.draft(max)}
        pickErrors={pickErrors}
        leftOutCount={leftOut}
        onAddFiles={addFiles}
        onMove={() => undefined}
        onMakeCover={() => undefined}
        onEditDescription={(id) => {
          onEditDescription?.(id);
        }}
        onDelete={() => undefined}
        onRemove={() => undefined}
        onRetry={() => undefined}
        onOpen={() => undefined}
      />
    </div>
  );
}
