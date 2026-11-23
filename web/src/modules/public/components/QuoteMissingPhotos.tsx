// The photos that did not upload (UI-SPEC Q3, D-03): a warning note naming them and the Messenger button to send them on. It loads
// with the photo piece, the only time photos can go missing, so the form's own piece keeps its budget (D-43).
import { ButtonLink } from '@/components/actions/ButtonLink';
import { Note } from '@/components/states/Note';
import { PUBLIC_COPY } from '../copy';

const COPY = PUBLIC_COPY.contact.form.success;

export interface QuoteMissingPhotosProps {
  /** The names of the photos that did not upload, in the order picked. */
  missing: readonly string[];
  /** How many photos were sent. */
  total: number;
  /** Null when no link is set or the shop facts could not be read. */
  messengerUrl: string | null;
}

export function QuoteMissingPhotos({ missing, total, messengerUrl }: QuoteMissingPhotosProps) {
  const note = missing.length >= total ? COPY.photosAllMissing : COPY.photosMissing(missing.length, missing.join(', '));
  return (
    <>
      <Note icon="triangle-alert">{note}</Note>
      {messengerUrl !== null && (
        <ButtonLink variant="secondary" icon="message-circle" to={messengerUrl}>
          {COPY.messenger}
        </ButtonLink>
      )}
    </>
  );
}
