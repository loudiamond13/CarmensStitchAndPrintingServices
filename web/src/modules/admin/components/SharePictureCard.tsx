// SPEC-GAP: link preview picture
// The Link preview picture card of Business Info (UI-SPEC S1 card 6; D-26, PUB-04; plan 11-34): one PhotoSlot (1.91:1, the word "Picture") over plan
// 11-30's routes. The picture saves on its own, at once, apart from the Business Info form: nothing typed there is read, reset or sent.
// The picture lives on the settings row, so each change moves the row's version (11-30 OI-1): the hooks read the settings again, and the card
// hands them to its form (`onSettingsChange`) so the next Save Business Info sends the new version.
import { MediaPlaceholder } from '@/components/brand';
import { Note } from '@/components/states';
import { PhotoSlot, type SlotPhoto } from '@/modules/admin/components/PhotoSlot';
import { SiteContentCard } from '@/modules/admin/components/SiteContentCard';
import { useUploadSharePicture } from '@/modules/admin/hooks/useSiteSettingsQuery';
import type { SharePicture, SiteSettings } from '@/modules/admin/services/siteSettingsService';
import { SITE_CONTENT_COPY } from '@/modules/admin/siteContentCopy';

const COPY = SITE_CONTENT_COPY.business.sharePicture;

export interface SharePictureCardProps {
  /** The saved picture as the settings read answers it, or null. */
  picture: SharePicture | null;
  /** The settings as read again after a change, or null when that read failed. */
  onSettingsChange?: ((settings: SiteSettings | null) => void) | undefined;
}

/** The saved picture as the slot draws it: the 320 and 640 previews of a 1.91:1 picture. */
function previewOf(picture: SharePicture): SlotPhoto {
  return {
    src: picture.src320,
    srcSet: `${picture.src320} 320w, ${picture.src640} 640w`,
    width: 320,
    height: 168,
  };
}

export function SharePictureCard({ picture, onSettingsChange }: SharePictureCardProps) {
  const upload = useUploadSharePicture({
    onSuccess: (settings) => {
      onSettingsChange?.(settings);
    },
  });
  return (
    <SiteContentCard title={COPY.card.title} hint={COPY.card.hint}>
      <PhotoSlot
        label={COPY.card.title}
        noun="Picture"
        ratio="1.91/1"
        photo={picture === null ? null : previewOf(picture)}
        alt={COPY.alt}
        placeholder={<MediaPlaceholder label={COPY.empty} ratio="1.91 / 1" className="h-full" />}
        hint={COPY.hint}
        onUpload={(file) => upload.submit(file)}
        savedToast={COPY.toast.saved}
      />
      <Note icon="info">{COPY.note}</Note>
    </SiteContentCard>
  );
}
