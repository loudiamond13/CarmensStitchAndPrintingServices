// SPEC-GAP: line photos
// The Photos card of the product line editor (UI-SPEC S4 card 5; D-02, CONT-02, PUB-03; plan 11-22): three PhotoSlots in a row (one column on a
// phone), Main photo (4:5, the drawn jersey of the line while empty), Back view and Fabric detail (1:1, a labelled box while empty). Each slot
// saves at once over plan 11-19's photo routes; the line form and its version are not involved (a photo does not change the line's version).
import { MediaPlaceholder } from '@/components/brand';
import { PhotoSlot, type SlotPhoto } from '@/modules/admin/components/PhotoSlot';
import { slotArtClasses } from '@/modules/admin/components/photoSlot.recipe';
import { SiteContentCard } from '@/modules/admin/components/SiteContentCard';
import { lineSlotsClasses } from '@/modules/admin/components/siteContent.recipe';
import { useUploadLinePhoto } from '@/modules/admin/hooks/useProductLineQueries';
import type { LinePhotoSlot, ProductLinePhoto, ProductLinePhotos } from '@/modules/admin/services/productLinesService';
import { SITE_CONTENT_COPY } from '@/modules/admin/siteContentCopy';
import { artFor, JerseyArt } from '@/modules/public/components/JerseyArt';

export type { ProductLinePhotos } from '@/modules/admin/services/productLinesService';

const COPY = SITE_CONTENT_COPY.productLine.photos;
const CARD = SITE_CONTENT_COPY.productLine.cards.photos;

export interface ProductLinePhotosCardProps {
  lineId: string;
  title: string;
  /** The number on the drawing and on the empty boxes. */
  number: string;
  /** The line's drawing: `basketball`, `volleyball`, `moto`, `longSleeves`, `polo` or `custom`. */
  placeholderArt: string;
  photos: ProductLinePhotos;
  /** A photo was saved in a slot (its address), or taken off (null): the editor keeps the line it shows in step. */
  onPhotoChange: (slot: LinePhotoSlot, photo: ProductLinePhoto | null) => void;
}

interface LineSlotProps extends ProductLinePhotosCardProps {
  slot: LinePhotoSlot;
}

const FRAMES = { main: '4/5', back: '1/1', fabric: '1/1' } as const;

function LineSlot({ lineId, title, number, placeholderArt, photos, onPhotoChange, slot }: LineSlotProps) {
  const label = COPY.slots[slot].label;
  const upload = useUploadLinePhoto(lineId, slot, {
    onSuccess: (photo) => {
      onPhotoChange(slot, photo);
    },
  });
  const photo = photos[slot];
  const saved: SlotPhoto | null = photo;
  const placeholder =
    slot === 'main' ? (
      <div role="img" aria-label={COPY.drawnJersey} className="size-full">
        <JerseyArt {...artFor(placeholderArt)} number={number} className={slotArtClasses} />
      </div>
    ) : (
      <MediaPlaceholder label={label} number={slot === 'back' ? number : undefined} ratio="1 / 1" className="h-full" />
    );
  return (
    <PhotoSlot
      label={label}
      ratio={FRAMES[slot]}
      photo={saved}
      alt={SITE_CONTENT_COPY.photoSlot.previewAlt(label, title)}
      placeholder={placeholder}
      hint={COPY.hint}
      onUpload={(file) => upload.submit(file)}
      savedToast={COPY.toast.saved}
    />
  );
}

export function ProductLinePhotosCard(props: ProductLinePhotosCardProps) {
  return (
    <SiteContentCard title={CARD.title} hint={CARD.hint}>
      <div className={lineSlotsClasses}>
        {(['main', 'back', 'fabric'] as const).map((slot) => (
          <LineSlot key={slot} {...props} slot={slot} />
        ))}
      </div>
    </SiteContentCard>
  );
}
