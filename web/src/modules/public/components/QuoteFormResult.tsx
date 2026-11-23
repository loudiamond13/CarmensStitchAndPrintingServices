// The Get a Quote result (UI-SPEC Q3): Inquiry sent with Send Another, and the missing photos note above it when photos did not
// upload (D-03; the note comes from the photo piece). The boxes for a send that did not go through are in QuoteSendAnswers.
import type { ReactNode } from 'react';
import { Button } from '@/components/actions/Button';
import { EmptyState } from '@/components/feedback/EmptyState';
import { PUBLIC_COPY } from '../copy';

const COPY = PUBLIC_COPY.contact.form;

export interface QuoteSentResultProps {
  onSendAnother: () => void;
  /** The missing photos note and its Messenger button, shown before Send Another. */
  photosNote?: ReactNode;
}

export function QuoteSentResult({ onSendAnother, photosNote }: QuoteSentResultProps) {
  return (
    <EmptyState
      icon="circle-check"
      level={2}
      title={COPY.success.title}
      message={COPY.success.message}
      action={
        <>
          {photosNote}
          <Button variant="secondary" onClick={onSendAnother}>
            {COPY.success.another}
          </Button>
        </>
      }
    />
  );
}
