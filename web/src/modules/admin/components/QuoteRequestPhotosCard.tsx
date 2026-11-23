// SPEC-GAP: quote request photos card (UI-SPEC R2 item 3; D-36). The P9 readonly photo tiles with a count chip; a press opens the
// photo viewer, whose Open Full Size is the server's 2000px address. Every address comes from the server (private delivery).
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { PhotoViewer, type PhotoTileModel, type PhotoViewerPhoto } from '@/components/media';
import { PhotoTile } from '@/components/media/PhotoTile';
import { Badge } from '@/components/status';
import {
  orderCardBodyClasses,
  orderCardClasses,
  orderCardHeadClasses,
  orderCardTitleClasses,
  orderCardTitleRowClasses,
} from '@/modules/admin/components/orderPage.recipe';
import { quotePhotoListClasses } from '@/modules/admin/components/quoteRequests.recipe';
import { VIEWER_SIZES } from '@/modules/admin/imageSlots';
import { QUOTE_REQUEST_COPY } from '@/modules/admin/quoteRequestsCopy';
import type { QuoteRequestDetailResponse, QuoteRequestPhoto } from '@/modules/admin/services/quoteRequestsService';
import { formatCount } from '@/utils/format';

const COPY = QUOTE_REQUEST_COPY.photos;
const TITLE_ID = 'quote-request-photos';

function photoId(photo: QuoteRequestPhoto): string {
  return `slot-${String(photo.slot)}`;
}

function tile(photo: QuoteRequestPhoto): PhotoTileModel {
  return {
    id: photoId(photo),
    state: 'saved',
    description: photo.fileName,
    thumb: { src: photo.thumb.src, srcSet: photo.thumb.srcSet, width: 88, height: 88 },
  };
}

function viewerPhoto(photo: QuoteRequestPhoto): PhotoViewerPhoto {
  return {
    id: photoId(photo),
    alt: photo.fileName,
    viewer: {
      src: photo.viewer.src,
      srcSet: photo.viewer.srcSet,
      width: Number(photo.width),
      height: Number(photo.height),
    },
    fullSize: photo.fullSize,
  };
}

const ignore = (): void => undefined;

export function QuoteRequestPhotosCard({ request }: { request: QuoteRequestDetailResponse }) {
  const photos = request.photos;
  const viewing = photos.map(viewerPhoto);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // The photo whose thumb takes focus once the viewer has closed.
  const returnTo = useRef<string | null>(null);

  const focusAfterViewer = useEffectEvent((): void => {
    const id = returnTo.current;
    if (id === null) return;
    returnTo.current = null;
    const at = viewing.findIndex((photo) => photo.id === id);
    listRef.current?.querySelectorAll<HTMLElement>('button[aria-label]')[at]?.focus();
  });
  useEffect(() => {
    if (viewerIndex === null) focusAfterViewer();
  }, [viewerIndex]);

  return (
    <section className={orderCardClasses} aria-labelledby={TITLE_ID}>
      <div className={orderCardHeadClasses}>
        <div className={orderCardTitleRowClasses}>
          <h2 id={TITLE_ID} className={orderCardTitleClasses}>
            {COPY.title}
          </h2>
          {photos.length > 0 && (
            <Badge tone="neutral">
              {formatCount(photos.length)}
              <span className={srOnlyClasses}> {COPY.countHidden(photos.length)}</span>
            </Badge>
          )}
        </div>
      </div>
      <div className={orderCardBodyClasses}>
        {photos.length > 0 && (
          <ul ref={listRef} className={quotePhotoListClasses} aria-label={COPY.listName}>
            {photos.map((photo, index) => (
              <PhotoTile
                key={photoId(photo)}
                photo={tile(photo)}
                position={index + 1}
                total={photos.length}
                mode="readonly"
                hasCover={false}
                busy={false}
                canDrag={false}
                onMove={ignore}
                onMakeCover={ignore}
                onEditDescription={ignore}
                onDelete={ignore}
                onRemove={ignore}
                onRetry={ignore}
                onOpen={(id) => {
                  const at = viewing.findIndex((shown) => shown.id === id);
                  if (at >= 0) setViewerIndex(at);
                }}
                onDragStart={ignore}
                onDragEnd={ignore}
                onDropOn={ignore}
              />
            ))}
          </ul>
        )}
      </div>
      {viewerIndex !== null && (
        <PhotoViewer
          photos={viewing}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={(lastShownId) => {
            returnTo.current = lastShownId;
            setViewerIndex(null);
          }}
          label={COPY.listName}
          sizes={VIEWER_SIZES}
        />
      )}
    </section>
  );
}
