// The Images card of the order page, O1 (ORD-04, IMG-05; UI-SPEC P1 and P3). Picked photos are prepared in the browser, queued in
// memory and uploaded one at a time; a saved photo shows the thumb the server delivers. Every figure and address is the server's.
// Moving, covering, describing and deleting a saved photo, and the viewer, arrive with plan 09-23: until then those controls stay
// disabled.
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/brand';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { ImageUploader, type PhotoTileModel } from '@/components/media';
import {
  orderPhotosBodyClasses,
  orderPhotosSpinnerClasses,
  orderPhotosStatusClasses,
} from '@/modules/admin/components/orderPhotos.recipe';
import {
  orderCardClasses,
  orderCardHeadClasses,
  orderCardHintClasses,
  orderCardTitleClasses,
} from '@/modules/admin/components/orderPage.recipe';
import { imageRulesQuery, useImageRulesQuery } from '@/modules/admin/hooks/useImageRulesQuery';
import { usePhotoUploadQueue, type QueueItem } from '@/modules/admin/hooks/usePhotoUploadQueue';
import { ORDER_PHOTOS_COPY } from '@/modules/admin/orderPhotosCopy';
import { toImageRules } from '@/modules/admin/orderPhotosSchemas';
import { isLocked } from '@/modules/admin/orderRules';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { prepareImage } from '@/utils/images';

const COPY = ORDER_PHOTOS_COPY;
const TITLE_ID = 'order-images';
const BYTES_PER_MEGABYTE = 1_048_576;
/** What the hint shows until the server's rules arrive; the pick itself always waits for the real rules. */
const DISPLAY_MAX = 5;
const DISPLAY_MEGABYTES = 10;

export interface OrderPhotosCardProps {
  order: OrderDetailResponse;
}

function savedTiles(order: OrderDetailResponse): PhotoTileModel[] {
  return [...order.images]
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map((image, index) => ({
      id: image.id,
      state: 'saved',
      description: image.description ?? COPY.defaultDescription.saved(order.number, index + 1),
      thumb: { src: image.thumb.src, srcSet: image.thumb.srcSet },
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

export function OrderPhotosCard({ order }: OrderPhotosCardProps) {
  const queryClient = useQueryClient();
  const rulesState = useImageRulesQuery();
  const queue = usePhotoUploadQueue(order.id);
  const rules = rulesState.data === undefined ? null : toImageRules(rulesState.data);
  const max = rules?.maxPerOrder ?? DISPLAY_MAX;
  const megabytes = rules === null ? DISPLAY_MEGABYTES : Number((rules.maxBytes / BYTES_PER_MEGABYTE).toFixed(1));
  const locked = isLocked(order);
  const photos = [...savedTiles(order), ...queue.items.map(queuedTile)];

  const addFiles = async (files: File[]): Promise<void> => {
    const current = toImageRules(await queryClient.query(imageRulesQuery));
    const ready = [];
    for (const file of files) {
      const prepared = await prepareImage(file, current);
      if (prepared.ok) {
        ready.push({
          blob: prepared.file,
          name: prepared.name,
          description: '',
          preview: prepared.preview,
          previewUnavailable: prepared.previewUnavailable,
        });
      }
    }
    queue.enqueue(ready);
  };

  return (
    <section className={orderCardClasses} aria-labelledby={TITLE_ID}>
      <div className={orderCardHeadClasses}>
        <div>
          <h2 id={TITLE_ID} tabIndex={-1} className={orderCardTitleClasses}>
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
        </div>
      </div>
      <div className={orderPhotosBodyClasses}>
        <ImageUploader
          photos={photos}
          max={max}
          maxMegabytes={megabytes}
          mode={locked ? 'readonly' : 'live'}
          busy
          limitNote={COPY.limit.live(max)}
          onAddFiles={(files) => {
            void addFiles(files);
          }}
          onMove={() => undefined}
          onMakeCover={() => undefined}
          onEditDescription={() => undefined}
          onDelete={() => undefined}
          onRemove={queue.remove}
          onRetry={queue.retry}
          onOpen={() => undefined}
        />
        <div aria-live="polite" className={srOnlyClasses}>
          {queue.announcement}
        </div>
      </div>
    </section>
  );
}
