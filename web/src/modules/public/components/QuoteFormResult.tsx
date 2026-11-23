// The Get a Quote result (UI-SPEC Q3, D-03).
import { Button } from '@/components/actions/Button';
import { EmptyState } from '@/components/feedback/EmptyState';
import { PUBLIC_COPY } from '../copy';

const COPY = PUBLIC_COPY.contact.form.success;

export interface QuoteSentResultProps {
  /** The names of the photos that did not upload, in the order picked. */
  missing: readonly string[];
  /** How many photos were sent. */
  total: number;
  messengerUrl: string | null;
  onSendAnother: () => void;
}

export function QuoteSentResult({ onSendAnother }: QuoteSentResultProps) {
  return (
    <EmptyState
      icon="circle-check"
      level={2}
      title={COPY.title}
      message={COPY.message}
      action={
        <Button variant="secondary" onClick={onSendAnother}>
          {COPY.another}
        </Button>
      }
    />
  );
}
