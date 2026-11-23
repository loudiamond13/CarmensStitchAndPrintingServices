// The Get a Quote result (UI-SPEC Q3): Inquiry sent with Send Another, and the missing photos note above it when photos did not
// upload (D-03; the note comes from the photo piece).
import type { ReactNode } from 'react';
import { Button } from '@/components/actions/Button';
import { EmptyState } from '@/components/feedback/EmptyState';
import { PUBLIC_COPY } from '../copy';

const COPY = PUBLIC_COPY.contact.form.success;

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
      title={COPY.title}
      message={COPY.message}
      action={
        <>
          {photosNote}
          <Button variant="secondary" onClick={onSendAnother}>
            {COPY.another}
          </Button>
        </>
      }
    />
  );
}
