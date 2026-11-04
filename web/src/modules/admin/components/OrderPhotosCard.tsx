// The Images card of the order page, O1 (ORD-04, IMG-05; UI-SPEC P1 and P3). Picked photos are prepared in the browser, queued in
// memory and uploaded one at a time; a saved photo shows the thumb the server delivers. Every figure and address is the server's.
// A saved photo's thumb opens the viewer (D-16); closing it puts focus on the thumb of the photo shown last. Moving a photo saves at
// once (D-13, D-15): the buttons and the drag send the same request, the page takes the server's answer, and the card says
// "Saved" and announces the new place. Describing and deleting a saved photo arrive in later plans.
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Icon } from '@/components/brand';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import {
  ImageUploader,
  MEDIA_COPY,
  PhotoViewer,
  type PhotoTileModel,
  type PhotoViewerPhoto,
  type PickError,
} from '@/components/media';
import {
  orderPhotosBannerBodyClasses,
  orderPhotosBannerClasses,
  orderPhotosBannerIconClasses,
  orderPhotosBannerTextClasses,
  orderPhotosBannerTitleClasses,
  orderPhotosBodyClasses,
  orderPhotosSavedIconClasses,
  orderPhotosSpinnerClasses,
  orderPhotosStatusClasses,
} from '@/modules/admin/components/orderPhotos.recipe';
import {
  orderCardClasses,
  orderCardHeadClasses,
  orderCardHintClasses,
  orderCardTitleClasses,
} from '@/modules/admin/components/orderPage.recipe';
import { useApplyOrder } from '@/modules/admin/hooks/useApplyOrder';
import { useOrderAction } from '@/modules/admin/hooks/useOrderAction';
import { imageRulesQuery, useImageRulesQuery } from '@/modules/admin/hooks/useImageRulesQuery';
import { VIEWER_SIZES } from '@/modules/admin/imageSlots';
import { orderKey } from '@/modules/admin/hooks/useOrderQuery';
import {
  photoUploadQueue,
  usePhotoUploadQueue,
  type PreparedUpload,
  type QueueItem,
} from '@/modules/admin/hooks/usePhotoUploadQueue';
import { ORDER_PHOTOS_COPY } from '@/modules/admin/orderPhotosCopy';
import {
  cleanFileName,
  pickFailureMessage,
  pickIssue,
  toImageRules,
  type ImageRules,
} from '@/modules/admin/orderPhotosSchemas';
import { isLocked } from '@/modules/admin/orderRules';
import { orderPhotosService } from '@/modules/admin/services/orderPhotosService';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { prepareImage, type PrepareResult } from '@/utils/images';

const COPY = ORDER_PHOTOS_COPY;
const TITLE_ID = 'order-images';
const BYTES_PER_MEGABYTE = 1_048_576;
/** What the hint shows until the server's rules arrive; the pick itself always waits for the real rules. */
const DISPLAY_MAX = 5;
const DISPLAY_MEGABYTES = 10;

export interface OrderPhotosCardProps {
  order: OrderDetailResponse;
  /** Forces the read-only card whatever the status: the Manager's deleted-order view (D-20). */
  readOnly?: boolean;
}

type OrderImage = OrderDetailResponse['images'][number];

/** The control to put focus on once a change is shown: the pressed move button, or Edit description after Make Cover. */
type FocusControl = 'left' | 'right' | 'cover';

/** One move (a button, Make Cover or a drag): the photo, the 0-based place it goes to and the control that asked. */
interface MoveTarget {
  readonly id: string;
  readonly toIndex: number;
  readonly control: FocusControl | null;
}

/** What waits for the answer to be on screen before focus moves: the photo order the answer has, and where focus goes. */
interface FocusPlan {
  readonly ids: readonly string[];
  readonly id: string;
  readonly control: FocusControl;
}

/** How long "Saved" stays on the status line (D-15). */
const SAVED_MS = 4000;

/** The saved photos in display order, each with its description (the stored one, else the default for its position). */
function orderedImages(order: OrderDetailResponse): { image: OrderImage; description: string }[] {
  return [...order.images]
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map((image, index) => ({
      image,
      description: image.description ?? COPY.defaultDescription.saved(order.number, index + 1),
    }));
}

function savedTiles(order: OrderDetailResponse): PhotoTileModel[] {
  return orderedImages(order).map(({ image, description }) => ({
    id: image.id,
    state: 'saved',
    description,
    thumb: { src: image.thumb.src, srcSet: image.thumb.srcSet },
  }));
}

function viewerPhotos(order: OrderDetailResponse): PhotoViewerPhoto[] {
  return orderedImages(order).map(({ image, description }) => ({
    id: image.id,
    alt: description,
    viewer: {
      src: image.viewer.src,
      srcSet: image.viewer.srcSet,
      width: Number(image.width),
      height: Number(image.height),
    },
    fullSize: image.fullSize,
  }));
}

function queuedTile(item: QueueItem): PhotoTileModel {
  return {
    id: item.id,
    state: item.state,
    description: item.description,
    fileName: item.name,
    preview: item.preview ?? undefined,
    previewUnavailable: item.previewUnavailable,
    failure: item.failure ?? undefined,
  };
}

export function OrderPhotosCard({ order, readOnly = false }: OrderPhotosCardProps) {
  const queryClient = useQueryClient();
  // Completed and Cancelled orders lock the card (D-11); the deleted view is always locked (D-20). Picking needs the rules.
  const locked = readOnly || isLocked(order);
  const rulesState = useImageRulesQuery(!locked);
  const queue = usePhotoUploadQueue(order.id);
  const rules = rulesState.data === undefined ? null : toImageRules(rulesState.data);
  const max = rules?.maxPerOrder ?? DISPLAY_MAX;
  const megabytes = rules === null ? DISPLAY_MEGABYTES : Number((rules.maxBytes / BYTES_PER_MEGABYTE).toFixed(1));
  const [pickErrors, setPickErrors] = useState<readonly PickError[]>([]);
  const [leftOut, setLeftOut] = useState(0);
  const photos = [...savedTiles(order), ...queue.items.map(queuedTile)];
  const viewing = viewerPhotos(order);

  // The viewer shows the saved photo at this position; null while it is closed.
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // The photo whose thumb takes focus once the viewer has closed.
  const returnTo = useRef<string | null>(null);

  const openViewer = (id: string): void => {
    const at = viewing.findIndex((photo) => photo.id === id);
    if (at >= 0) {
      setViewerIndex(at);
    }
  };
  const closeViewer = (lastShownId: string): void => {
    returnTo.current = lastShownId;
    setViewerIndex(null);
  };
  // After the viewer's own focus return: the thumb of the photo shown last, else the card heading (no photos left).
  const focusAfterViewer = useEffectEvent((): void => {
    const id = returnTo.current;
    if (id === null) {
      return;
    }
    returnTo.current = null;
    const at = viewing.findIndex((photo) => photo.id === id);
    const photo = viewing[at];
    const name = photo === undefined ? undefined : MEDIA_COPY.tile.open(at + 1, viewing.length, photo.alt);
    const thumb = [...(bodyRef.current?.querySelectorAll<HTMLElement>('button[aria-label]') ?? [])].find(
      (button) => button.getAttribute('aria-label') === name,
    );
    const target = thumb ?? headingRef.current;
    target?.scrollIntoView({ block: 'nearest' });
    target?.focus({ preventScroll: true });
  });
  useEffect(() => {
    if (viewerIndex === null) {
      focusAfterViewer();
    }
  }, [viewerIndex]);

  const applyOrder = useApplyOrder();
  // The small "Saved" line of the card head (cleared after 4 seconds or at the next change) and the spoken line.
  const [saved, setSaved] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const focusPlan = useRef<FocusPlan | null>(null);
  useEffect(() => {
    if (!saved) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setSaved(false);
    }, SAVED_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [saved]);

  // A change is based on the latest answer the page holds, so a coworker's write that landed since the render is not undone.
  const latestVersion = (): string =>
    queryClient.getQueryData<OrderDetailResponse>(orderKey(order.id))?.version ?? order.version;

  const moving = useOrderAction<MoveTarget>(
    (_key, target) => orderPhotosService.move(order.id, target.id, target.toIndex, latestVersion()),
    (answer, target) => {
      applyOrder(answer);
      const ids = orderedImages(answer).map(({ image }) => image.id);
      const position = ids.indexOf(target.id) + 1;
      setAnnouncement(
        position === 1 ? COPY.announce.movedCover(ids.length) : COPY.announce.moved(position, ids.length),
      );
      setSaved(true);
      focusPlan.current = target.control === null ? null : { ids, id: target.id, control: target.control };
    },
  );
  // Saved photos can change only while no change is saving and nothing is uploading (UI-SPEC busy rule).
  const busy = moving.pending || queue.items.some((item) => item.state === 'waiting' || item.state === 'uploading');

  // Which move control has focus now: the answer puts focus back on it, on the moved photo. A drag leaves focus alone.
  const pressedControl = (position: number): FocusControl | null => {
    const label = document.activeElement?.getAttribute('aria-label');
    if (label === MEDIA_COPY.tile.moveLeft(position)) return 'left';
    if (label === MEDIA_COPY.tile.moveRight(position)) return 'right';
    return null;
  };

  const move = (id: string, toIndex: number, control: FocusControl | null): void => {
    const places = orderedImages(order);
    const from = places.findIndex(({ image }) => image.id === id);
    if (busy || from < 0 || toIndex < 0 || toIndex >= places.length || toIndex === from) {
      return;
    }
    setAnnouncement('');
    setSaved(false);
    focusPlan.current = null;
    void moving.submit({ id, toIndex, control: control ?? pressedControl(from + 1) });
  };
  const onMove = (id: string, toIndex: number): void => {
    move(id, toIndex, null);
  };

  // Once the answer is on screen, focus goes back to the pressed control on the moved photo. When that control is disabled at an
  // end of the list, the photo's other move button takes it.
  const focusMoved = useEffectEvent((): void => {
    const plan = focusPlan.current;
    if (plan === null) {
      return;
    }
    const ids = orderedImages(order).map(({ image }) => image.id);
    if (ids.join() !== plan.ids.join()) {
      return;
    }
    focusPlan.current = null;
    const position = ids.indexOf(plan.id) + 1;
    const tile = MEDIA_COPY.tile;
    let name = tile.editDescription(position);
    if (plan.control === 'left') {
      name = position === 1 ? tile.moveRight(position) : tile.moveLeft(position);
    } else if (plan.control === 'right') {
      name = position === ids.length ? tile.moveLeft(position) : tile.moveRight(position);
    }
    const control = [...(bodyRef.current?.querySelectorAll<HTMLElement>('button[aria-label]') ?? [])].find(
      (button) => button.getAttribute('aria-label') === name,
    );
    control?.focus();
  });
  useEffect(() => {
    focusMoved();
  }, [order]);

  // One pick at a time, so a second pick counts the files the first one queued.
  const picking = useRef<Promise<void>>(Promise.resolve());

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
    const saved =
      queryClient.getQueryData<OrderDetailResponse>(orderKey(order.id))?.images.length ?? order.images.length;
    let room = Math.max(0, current.maxPerOrder - saved - photoUploadQueue.snapshot(order.id).pending);
    const ready: PreparedUpload[] = [];
    const refused: PickError[] = [];
    let leftOutCount = 0;
    for (const file of files) {
      if (room <= 0) {
        leftOutCount += 1;
        continue;
      }
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
      ready.push({
        blob: prepared.file,
        name: prepared.name,
        description: '',
        preview: prepared.preview,
        previewUnavailable: prepared.previewUnavailable,
      });
      room -= 1;
    }
    setPickErrors(refused);
    setLeftOut(leftOutCount);
    queue.enqueue(ready);
  };

  const addFiles = (files: File[]): void => {
    picking.current = picking.current.then(() => runPick(files));
  };

  return (
    <section className={orderCardClasses} aria-labelledby={TITLE_ID}>
      <div className={orderCardHeadClasses}>
        <div>
          <h2 ref={headingRef} id={TITLE_ID} tabIndex={-1} className={orderCardTitleClasses}>
            {COPY.title}
          </h2>
          <p className={orderCardHintClasses}>{COPY.hints.live}</p>
        </div>
        <div role="status" className={orderPhotosStatusClasses}>
          {queue.progress !== null && (
            <>
              <Icon name="loader-circle" size={14} className={orderPhotosSpinnerClasses} />
              {COPY.status.uploading(queue.progress.index, queue.progress.total)}
            </>
          )}
          {queue.progress === null && saved && (
            <>
              <span className={orderPhotosSavedIconClasses}>
                <Icon name="check" size={14} />
              </span>
              {COPY.status.saved}
            </>
          )}
        </div>
      </div>
      <div ref={bodyRef} className={orderPhotosBodyClasses}>
        {queue.failed > 0 && queue.progress === null && (
          <div role="alert" className={orderPhotosBannerClasses}>
            <span className={orderPhotosBannerIconClasses}>
              <Icon name="triangle-alert" size={20} />
            </span>
            <div className={orderPhotosBannerTextClasses}>
              <p className={orderPhotosBannerTitleClasses}>{COPY.banner.title(queue.failed, queue.batchTotal)}</p>
              <p className={orderPhotosBannerBodyClasses}>{COPY.banner.body}</p>
            </div>
          </div>
        )}
        <ImageUploader
          photos={photos}
          max={max}
          maxMegabytes={megabytes}
          mode={locked ? 'readonly' : 'live'}
          busy={busy}
          limitNote={COPY.limit.live(max)}
          pickErrors={pickErrors}
          leftOutCount={leftOut}
          onAddFiles={addFiles}
          onMove={onMove}
          onMakeCover={() => undefined}
          onEditDescription={() => undefined}
          onDelete={() => undefined}
          onRemove={queue.remove}
          onRetry={queue.retry}
          onOpen={openViewer}
        />
        <div aria-live="polite" className={srOnlyClasses}>
          {queue.announcement}
        </div>
        <div aria-live="polite" className={srOnlyClasses}>
          {announcement}
        </div>
      </div>
      {viewerIndex !== null && (
        <PhotoViewer
          photos={viewing}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={closeViewer}
          label={MEDIA_COPY.uploader.listName}
          sizes={VIEWER_SIZES}
        />
      )}
    </section>
  );
}
