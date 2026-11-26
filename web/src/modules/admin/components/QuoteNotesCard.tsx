// SPEC-GAP: quote request Notes card (UI-SPEC R2 item 4; D-17, OR-3). An add-only list of staff notes, newest first as the server
// sends them, and the Add a note box. The note is checked in the browser with the server's rule and words before it is sent, with an
// Idempotency-Key. The answer holds no note text, so the page reads the request again to show it. A 409 keeps the typed note and the
// page shows its ConflictBanner; a 404 means the request is gone and the page shows not found. Text only (CWE-79).
import { zodResolver } from '@hookform/resolvers/zod';
import clsx from 'clsx';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button } from '@/components/actions';
import { ActorName } from '@/components/data';
import { useToast } from '@/components/feedback';
import { Field } from '@/components/forms';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { isHttpError } from '@/core/api/errors';
import { serverFieldMessage } from '@/lib/forms/serverFieldMessage';
import { useSubmission } from '@/lib/forms/useSubmission';
import {
  orderCardBodyClasses,
  orderCardClasses,
  orderCardHeadClasses,
  orderCardTitleClasses,
} from '@/modules/admin/components/orderPage.recipe';
import {
  quoteMessageClasses,
  quoteMutedClasses,
  quoteNoteAuthorClasses,
  quoteNoteFieldClasses,
  quoteNoteFormClasses,
  quoteNoteListClasses,
  quoteValueClasses,
} from '@/modules/admin/components/quoteRequests.recipe';
import { quoteRequestKey } from '@/modules/admin/hooks/useQuoteRequestQuery';
import { QUOTE_REQUEST_COPY } from '@/modules/admin/quoteRequestsCopy';
import { noteSchema, type NoteInput, type NoteValues } from '@/modules/admin/quoteRequestsSchemas';
import {
  quoteRequestsService,
  type QuoteRequestDetailResponse,
  type QuoteRequestNoteAdded,
} from '@/modules/admin/services/quoteRequestsService';
import { errorLine } from '@/utils/describeHttpError';
import { formatBusinessDateTime } from '@/utils/format';

const COPY = QUOTE_REQUEST_COPY.notes;
const TITLE_ID = 'quote-request-notes';
const CONFLICT = 'quote-requests.conflict';
const FIELD_ROWS = 3;

export interface QuoteNotesCardProps {
  request: QuoteRequestDetailResponse;
  /** A note was saved: the page takes the new version and reads the request again. */
  onAdded: (answer: QuoteRequestNoteAdded) => void;
  /** Someone else changed the request at the same moment (409): the page shows the ConflictBanner. */
  onConflict: () => void;
}

export function QuoteNotesCard({ request, onAdded, onConflict }: QuoteNotesCardProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();
  const queryClient = useQueryClient();
  // The polite line; it clears when typing starts, so the next note is announced again.
  const [status, setStatus] = useState('');
  const form = useForm<NoteInput, unknown, NoteValues>({
    resolver: zodResolver(noteSchema),
    defaultValues: { text: '' },
  });
  const { control, handleSubmit, setError, reset, getValues } = form;

  const focusBox = (): void => {
    const box = formRef.current?.elements.namedItem('text');
    if (box instanceof HTMLElement) box.focus();
  };

  const add = useSubmission<string, QuoteRequestNoteAdded>(
    (key, text) => quoteRequestsService.addNote(request.id, text, key),
    {
      onSuccess: (answer, text) => {
        // Text typed while the note was sending stays in the box.
        if (getValues('text').trim() === text) reset({ text: '' });
        setStatus(COPY.added);
        focusBox();
        onAdded(answer);
      },
      onFailure: (copy, error) => {
        if (isHttpError(error) && error.status === 409 && error.code === CONFLICT) {
          onConflict();
          return;
        }
        if (isHttpError(error) && error.kind === 'http' && error.status === 404) {
          void queryClient.resetQueries({ queryKey: quoteRequestKey(request.id) });
          return;
        }
        const message = isHttpError(error) ? serverFieldMessage(error.fieldErrors, 'text') : undefined;
        if (message !== undefined) {
          setError('text', { type: 'server', message });
          focusBox();
          return;
        }
        toast.show({ tone: 'danger', title: COPY.failed, message: errorLine(copy) });
      },
    },
  );

  const onValid = async (values: NoteValues): Promise<void> => {
    const outcome = await add.submit(values.text);
    // A saved note is done, so the same words typed again are a new note with a new key.
    if (outcome.ok) add.reset();
  };

  return (
    <section className={orderCardClasses} aria-labelledby={TITLE_ID}>
      <div className={orderCardHeadClasses}>
        <div>
          <h2 id={TITLE_ID} className={orderCardTitleClasses}>
            {COPY.title}
          </h2>
          <p className={quoteMutedClasses}>{COPY.hint}</p>
        </div>
      </div>
      <div className={orderCardBodyClasses}>
        <form
          ref={formRef}
          noValidate
          className={quoteNoteFormClasses}
          onSubmit={(event) => {
            void handleSubmit(onValid, focusBox)(event);
          }}
        >
          <Controller
            control={control}
            name="text"
            render={({ field, fieldState }) => (
              <Field
                multiline
                rows={FIELD_ROWS}
                className={quoteNoteFieldClasses}
                label={COPY.label}
                name={field.name}
                value={field.value}
                onChange={(event) => {
                  setStatus('');
                  field.onChange(event);
                }}
                onBlur={field.onBlur}
                error={fieldState.error?.message ?? ''}
              />
            )}
          />
          <Button type="submit" variant="secondary" icon="plus" pending={add.pending}>
            {add.pending ? COPY.adding : COPY.add}
          </Button>
        </form>
        <div role="status" aria-live="polite" className={srOnlyClasses}>
          {status}
        </div>
        {request.notes.length === 0 ? (
          <p className={quoteMutedClasses}>{COPY.empty}</p>
        ) : (
          <ol className={quoteNoteListClasses}>
            {request.notes.map((note) => (
              <li key={note.id}>
                <p className={quoteNoteAuthorClasses}>
                  <ActorName actor={note.createdBy} />
                </p>
                <p className={quoteMutedClasses}>
                  <time dateTime={note.createdAtUtc}>
                    {formatBusinessDateTime(note.createdAtUtc) ?? note.createdAtUtc}
                  </time>
                </p>
                <p className={clsx(quoteValueClasses, quoteMessageClasses)}>{note.text}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
