// The Phase 9 demos of the Component Showcase (UI-SPEC Component Inventory "Component Showcase additions" and "UI Considerations";
// plan 09-30): the order photo pieces on made-up photos, in the "Order photos" section. Every photo is a small SVG drawn here as a
// `data:` address, so nothing is ever requested and no photo store is touched. The pieces are the real shared parts wired to local
// state: the photo list in its states (saved, uploading, waiting, failed, draft, no preview, pick errors, over the limit), the
// partial-failure banner and status line, the viewer on tall and wide photos, the description window with its 409 banner, the delete
// dialog and the Orders list covers. The static cases sit in page-root frames; a live demo that opens a fixed layer sits in a frame
// that is no page root.
import { useState } from 'react';
import {
  Button,
  ConfirmDialog,
  Field,
  ImageUploader,
  LazyImage,
  OrderCard,
  PhotoViewer,
  type OrderCardCover,
  type OrderCardOrder,
  type PhotoTileModel,
  type PhotoViewerPhoto,
  type PickError,
} from '@/components';
import { Icon } from '@/components/brand';
import { OrderWindow } from '@/modules/admin/components/OrderWindow';
import {
  orderPhotosBannerBodyClasses,
  orderPhotosBannerClasses,
  orderPhotosBannerIconClasses,
  orderPhotosBannerTextClasses,
  orderPhotosBannerTitleClasses,
  orderPhotosSavedIconClasses,
  orderPhotosSpinnerClasses,
  orderPhotosStatusClasses,
} from '@/modules/admin/components/orderPhotos.recipe';
import { DemoCase } from '@/modules/admin/components/showcase/Phase5Demos';
import {
  loadedImageClasses,
  orderCardsGridClasses,
  photoCaseColumnClasses,
  photoStatusRowClasses,
  staffStackClasses,
} from '@/modules/admin/components/showcase/showcase.recipe';
import { SHOWCASE_COPY } from '@/modules/admin/components/showcase/showcaseCopy';
import { ORDER_PHOTOS_COPY } from '@/modules/admin/orderPhotosCopy';

const DEMO = SHOWCASE_COPY.photos;
const COPY = ORDER_PHOTOS_COPY;
const ORDER_NUMBER = 'ORD-2026-0148';
const MAX = 5;
const MEGABYTES = 10;

/** A made-up photo: a gradient with a circle, drawn as a `data:` address. The size is the stored size (it sets the box ratio). */
function demoPhoto(hue: number, width: number, height: number): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${String(width)}" height="${String(height)}" viewBox="0 0 ${String(width)} ${String(height)}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${String(hue)} 60% 42%)"/>` +
    `<stop offset="1" stop-color="hsl(${String((hue + 70) % 360)} 65% 62%)"/></linearGradient></defs>` +
    `<rect width="100%" height="100%" fill="url(#g)"/>` +
    `<circle cx="${String(width / 2)}" cy="${String(height / 2)}" r="${String(Math.min(width, height) / 4)}" fill="hsl(${String(hue)} 40% 92%)" fill-opacity="0.8"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** A saved photo tile. The default description follows the photo's place, as in the app. */
function saved(position: number, hue: number, description?: string): PhotoTileModel {
  const src = demoPhoto(hue, 640, 480);
  return {
    id: `saved-${String(position)}`,
    state: 'saved',
    description: description ?? COPY.defaultDescription.saved(ORDER_NUMBER, position),
    thumb: { src, width: 640, height: 480 },
  };
}

const SAVED_THREE: readonly PhotoTileModel[] = [saved(1, 200), saved(2, 20), saved(3, 130)];
const SAVED_FIVE: readonly PhotoTileModel[] = [...SAVED_THREE, saved(4, 280), saved(5, 60)];

/** The tiles of an upload in progress: two saved, one uploading, one waiting, one failed that can be tried again. */
const UPLOAD_TILES: readonly PhotoTileModel[] = [
  saved(1, 200),
  saved(2, 20),
  {
    id: 'uploading',
    state: 'uploading',
    description: '',
    fileName: 'front-mockup.jpg',
    preview: demoPhoto(90, 176, 132),
  },
  { id: 'waiting', state: 'waiting', description: '', fileName: 'back-mockup.jpg', preview: demoPhoto(310, 176, 132) },
  {
    id: 'failed',
    state: 'failed',
    description: '',
    fileName: 'sleeve.jpg',
    preview: demoPhoto(150, 176, 132),
    failure: { reason: COPY.reasons.network, retryable: true },
  },
];

/** A file that failed for a reason trying again cannot fix. */
const NOT_RETRYABLE: readonly PhotoTileModel[] = [
  saved(1, 200),
  {
    id: 'refused',
    state: 'failed',
    description: '',
    fileName: 'logo.png',
    failure: { reason: COPY.reasons.refused, retryable: false },
  },
];

/** The New Order form's drafts: one with its preview, one still being made, one the browser cannot draw. */
const DRAFT_TILES: readonly PhotoTileModel[] = [
  {
    id: 'draft-1',
    state: 'draft',
    description: COPY.defaultDescription.draft(1),
    fileName: 'front.jpg',
    preview: demoPhoto(200, 176, 132),
  },
  {
    id: 'draft-2',
    state: 'draft',
    description: COPY.defaultDescription.draft(2),
    fileName: 'back.jpg',
    previewPending: true,
  },
  {
    id: 'draft-3',
    state: 'draft',
    description: COPY.defaultDescription.draft(3),
    fileName: 'IMG_4021.HEIC',
    previewUnavailable: true,
  },
];

/** The longest description (200 characters) and a long file name: the worst case for a tile. */
const LONG_DESCRIPTION =
  `Front of the jersey in red and black with the team crest on the chest, the sponsor names across the shoulders and the player number on the back. ${'Very long. '.repeat(5)}`.slice(
    0,
    200,
  );
const LONG_NAME_TILES: readonly PhotoTileModel[] = [
  saved(1, 200, LONG_DESCRIPTION),
  {
    id: 'long-name',
    state: 'failed',
    description: '',
    fileName: `${'team-photo-with-a-very-long-name-'.repeat(3)}.jpg`,
    failure: { reason: COPY.reasons.rulesUnavailable, retryable: true },
  },
];

const PICK_ERRORS: readonly PickError[] = [
  { fileName: 'logo.svg', reason: COPY.reasons.type('logo.svg') },
  { fileName: 'scan.png', reason: COPY.reasons.size('scan.png', '10 MB') },
  { fileName: 'panorama.jpg', reason: COPY.reasons.pixels('panorama.jpg', 25) },
];

const noop = (): void => undefined;

interface UploaderDemoProps {
  photos: readonly PhotoTileModel[];
  mode: 'draft' | 'live' | 'readonly';
  busy?: boolean;
  pickErrors?: readonly PickError[];
  leftOutCount?: number;
}

/** The photo list on local data: every handler does nothing. */
function UploaderDemo({ photos, mode, busy = false, pickErrors = [], leftOutCount = 0 }: UploaderDemoProps) {
  return (
    <ImageUploader
      photos={photos}
      max={MAX}
      maxMegabytes={MEGABYTES}
      mode={mode}
      busy={busy}
      limitNote={mode === 'draft' ? COPY.limit.draft(MAX) : COPY.limit.live(MAX)}
      pickErrors={pickErrors}
      leftOutCount={leftOutCount}
      onAddFiles={noop}
      onMove={noop}
      onMakeCover={noop}
      onEditDescription={noop}
      onDelete={noop}
      onRemove={noop}
      onRetry={noop}
      onOpen={noop}
    />
  );
}

/** The card head's status line and the partial-failure banner, as the order page draws them. */
function StatusDemo() {
  return (
    <div className={photoCaseColumnClasses}>
      <div className={photoStatusRowClasses}>
        <div role="status" className={orderPhotosStatusClasses}>
          <Icon name="loader-circle" size={14} className={orderPhotosSpinnerClasses} />
          {COPY.status.uploading(2, 3)}
        </div>
        <div className={orderPhotosStatusClasses}>
          <span className={orderPhotosSavedIconClasses}>
            <Icon name="check" size={14} />
          </span>
          {COPY.status.saved}
        </div>
      </div>
      <div role="alert" className={orderPhotosBannerClasses}>
        <span className={orderPhotosBannerIconClasses}>
          <Icon name="triangle-alert" size={20} />
        </span>
        <div className={orderPhotosBannerTextClasses}>
          <p className={orderPhotosBannerTitleClasses}>{COPY.banner.title(1, 3)}</p>
          <p className={orderPhotosBannerBodyClasses}>{COPY.banner.body}</p>
        </div>
      </div>
    </div>
  );
}

/** Photos of every shape, so the viewer shows a portrait, a landscape, a very tall and a very wide one whole. */
const VIEWER_SHAPES: readonly {
  readonly name: string;
  readonly hue: number;
  readonly width: number;
  readonly height: number;
}[] = [
  { name: 'Landscape', hue: 200, width: 1600, height: 1200 },
  { name: 'Portrait', hue: 20, width: 1200, height: 1600 },
  { name: 'Very tall', hue: 130, width: 500, height: 2000 },
  { name: 'Very wide', hue: 280, width: 2000, height: 500 },
  { name: 'Square', hue: 60, width: 1200, height: 1200 },
];

const VIEWER_PHOTOS: readonly PhotoViewerPhoto[] = VIEWER_SHAPES.map((shape, index) => ({
  id: `viewer-${String(index + 1)}`,
  alt: `${shape.name} photo of order ${ORDER_NUMBER}`,
  viewer: {
    src: demoPhoto(shape.hue, shape.width, shape.height),
    srcSet: '',
    width: shape.width,
    height: shape.height,
  },
}));

/** The viewer opened from a button, on five photos or on one. */
function ViewerDemo() {
  const [photos, setPhotos] = useState<readonly PhotoViewerPhoto[] | null>(null);
  const [index, setIndex] = useState(0);
  const open = (list: readonly PhotoViewerPhoto[]): void => {
    setIndex(0);
    setPhotos(list);
  };
  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          open(VIEWER_PHOTOS);
        }}
      >
        {DEMO.openViewer}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          open(VIEWER_PHOTOS.slice(0, 1));
        }}
      >
        {DEMO.openViewerOne}
      </Button>
      {photos !== null && (
        <PhotoViewer
          photos={photos}
          index={index}
          onIndexChange={setIndex}
          onClose={() => {
            setPhotos(null);
          }}
          label="Order photos"
        />
      )}
    </>
  );
}

/** The description window with the banner shown when someone else saved first. Nothing is saved. */
function DescriptionDemo() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(COPY.defaultDescription.saved(ORDER_NUMBER, 1));
  const close = (): void => {
    setOpen(false);
  };
  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          setOpen(true);
        }}
      >
        {DEMO.openDescription}
      </Button>
      {open && (
        <OrderWindow
          title={COPY.description.title}
          description={COPY.description.forOrder(ORDER_NUMBER, 1, 3)}
          isDirty={false}
          pending={false}
          banner={{ kind: 'conflict', count: 1 }}
          onLoadLatest={noop}
          saveLabel={COPY.description.save}
          onSave={close}
          onClose={close}
        >
          <Field
            multiline
            rows={3}
            name="description"
            label={COPY.description.label}
            hint={COPY.description.hint}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
            }}
          />
        </OrderWindow>
      )}
    </>
  );
}

/** The delete photo dialog. Confirming only closes it. */
function DeleteDemo() {
  const [open, setOpen] = useState(false);
  const close = (): void => {
    setOpen(false);
  };
  return (
    <>
      <Button
        variant="danger"
        size="sm"
        onClick={() => {
          setOpen(true);
        }}
      >
        {DEMO.openDelete}
      </Button>
      <ConfirmDialog
        open={open}
        title={COPY.delete.title(1)}
        message={COPY.delete.message(ORDER_NUMBER)}
        cancelLabel={COPY.delete.cancel}
        confirmLabel={COPY.delete.confirm}
        pendingLabel={COPY.delete.pending}
        onConfirm={close}
        onCancel={close}
      />
    </>
  );
}

const COVER_ORDER: OrderCardOrder = {
  number: ORDER_NUMBER,
  status: 'production',
  teamName: 'Brgy. San Roque Ballers',
  customerName: 'Juan Dela Cruz',
  orderDate: '2026-09-28',
  dueDate: '2026-10-14',
  pieces: 48,
  subtotal: '22450.00',
  discount: '1122.50',
  total: '21327.50',
  paid: '12000.00',
  refunded: '0.00',
  balance: '9327.50',
  customerCredit: '0.00',
  fullyPaid: false,
  expenses: '6065.00',
  profit: '15262.50',
};

function cover(count: number): OrderCardCover {
  return { image: { src: demoPhoto(200, 640, 400), srcSet: '', width: 640, height: 400 }, count };
}

/** The Orders list covers: three photos (the image chip), one photo (no chip) and no photo (the placeholder). */
function CoversDemo() {
  return (
    <div className={orderCardsGridClasses}>
      <OrderCard order={COVER_ORDER} cover={cover(3)} onView={noop} onEdit={noop} />
      <OrderCard order={{ ...COVER_ORDER, number: 'ORD-2026-0149' }} cover={cover(1)} onView={noop} onEdit={noop} />
      <OrderCard order={{ ...COVER_ORDER, number: 'ORD-2026-0150' }} onView={noop} onEdit={noop} />
    </div>
  );
}

/** A photo that fails to load: the box becomes an image named by its description. */
function BrokenPhotoDemo() {
  return (
    <LazyImage
      src="data:image/jpeg;base64,AAAA"
      alt={`Order ${ORDER_NUMBER} photo 1`}
      width={640}
      height={480}
      ratio="4 / 3"
      className={loadedImageClasses}
    />
  );
}

/** Every Phase 9 demo, one case under another. */
export function Phase9Demos() {
  return (
    <div className={staffStackClasses}>
      <DemoCase id="photos-list-three">
        <UploaderDemo photos={SAVED_THREE} mode="live" />
      </DemoCase>
      <DemoCase id="photos-list-one">
        <UploaderDemo photos={SAVED_THREE.slice(0, 1)} mode="live" />
      </DemoCase>
      <DemoCase id="photos-list-limit">
        <UploaderDemo photos={SAVED_FIVE} mode="live" />
      </DemoCase>
      <DemoCase id="photos-list-uploading">
        <UploaderDemo photos={UPLOAD_TILES} mode="live" busy />
      </DemoCase>
      <DemoCase id="photos-list-not-retryable">
        <UploaderDemo photos={NOT_RETRYABLE} mode="live" />
      </DemoCase>
      <DemoCase id="photos-list-drafts">
        <UploaderDemo photos={DRAFT_TILES} mode="draft" pickErrors={PICK_ERRORS} leftOutCount={2} />
      </DemoCase>
      <DemoCase id="photos-list-readonly-empty">
        <UploaderDemo photos={[]} mode="readonly" />
      </DemoCase>
      <DemoCase id="photos-list-long-text">
        <UploaderDemo photos={LONG_NAME_TILES} mode="live" />
      </DemoCase>
      <DemoCase id="photos-status-and-banner">
        <StatusDemo />
      </DemoCase>
      <DemoCase id="photos-image-failure">
        <BrokenPhotoDemo />
      </DemoCase>
      <DemoCase id="photos-order-covers">
        <CoversDemo />
      </DemoCase>
      <DemoCase id="photos-viewer" live>
        <ViewerDemo />
      </DemoCase>
      <DemoCase id="photos-description-conflict" live>
        <DescriptionDemo />
      </DemoCase>
      <DemoCase id="photos-delete-dialog" live>
        <DeleteDemo />
      </DemoCase>
    </div>
  );
}
