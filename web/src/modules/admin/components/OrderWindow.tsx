// The frame of the order windows (UI-SPEC O2, D-58; plan 08-14): a Modal with the title, the description "{number} · {team or
// customer}", a form body (banner, fields, record meta) and the footer: a plain Cancel and a primary `check` Save. The item,
// payment, discount, expense and refund windows all sit in it. When something was typed, Cancel, Esc, the scrim and the close
// button ask "Discard changes?" first; a clean window closes at once, and nothing closes while a save runs.
import { useId, useState, type ReactNode, type Ref } from 'react';
import { Button } from '@/components/actions';
import { Icon } from '@/components/brand';
import { messageClasses } from '@/components/forms';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { ConfirmDialog, Modal } from '@/components/overlays';
import { ConflictBanner, ErrorState } from '@/components/states';
import { orderWindowBodyClasses } from '@/modules/admin/components/orderWindow.recipe';
import type { OrderWindowBanner } from '@/modules/admin/hooks/useOrderChildSave';
import { ORDER_WINDOWS_COPY } from '@/modules/admin/orderWindowsCopy';

const COPY = ORDER_WINDOWS_COPY;

export interface OrderWindowProps {
  title: string;
  /** "{ORD-2026-0148} · {team or customer}". */
  description: string;
  /** False plays the close animation and then renders nothing. Default true. */
  open?: boolean | undefined;
  /** Any field differs from its opening value. */
  isDirty: boolean;
  /** A save is running. */
  pending: boolean;
  /** What to show above the fields. */
  banner?: OrderWindowBanner | null | undefined;
  /** Load Latest is on its way. */
  loadingLatest?: boolean | undefined;
  onLoadLatest?: (() => void) | undefined;
  /** The polite line read out after Load Latest. */
  status?: string | undefined;
  /** The Recorded by and Last changed by block of an edit window. */
  recordMeta?: ReactNode;
  /** "Save Item". */
  saveLabel: string;
  /** Save looks and acts disabled but keeps focus: the order is locked or the record is gone. */
  saveBlocked?: boolean | undefined;
  /** The form was submitted by Save or Enter. */
  onSave: () => void;
  /** The window closes: after a clean close, or after Discard Changes. */
  onClose: () => void;
  formRef?: Ref<HTMLFormElement> | undefined;
  saveRef?: Ref<HTMLButtonElement> | undefined;
  children: ReactNode;
}

function Banner({
  banner,
  loadingLatest,
  onLoadLatest,
}: {
  banner: OrderWindowBanner;
  loadingLatest: boolean;
  onLoadLatest: () => void;
}) {
  switch (banner.kind) {
    case 'conflict':
      return <ConflictBanner key={banner.count} pending={loadingLatest} onLoadLatest={onLoadLatest} />;
    case 'removed':
      return <ErrorState title={banner.title} message={banner.body} align="start" />;
    case 'message':
      return (
        <p className={messageClasses({ error: true })} role="alert">
          <Icon name="triangle-alert" size={14} />
          {banner.text}
        </p>
      );
  }
}

export function OrderWindow({
  title,
  description,
  open = true,
  isDirty,
  pending,
  banner = null,
  loadingLatest = false,
  onLoadLatest,
  status = '',
  recordMeta,
  saveLabel,
  saveBlocked = false,
  onSave,
  onClose,
  formRef,
  saveRef,
  children,
}: OrderWindowProps) {
  const formId = useId();
  const [asking, setAsking] = useState(false);

  // D-58: a dirty window asks before it drops what was typed; nothing closes while a save runs.
  const requestClose = (): void => {
    if (pending) {
      return;
    }
    if (isDirty) {
      setAsking(true);
      return;
    }
    onClose();
  };

  return (
    <>
      <Modal
        open={open}
        title={title}
        description={description}
        onClose={requestClose}
        loading={pending}
        footer={
          <>
            <Button variant="secondary" onClick={requestClose}>
              {COPY.cancel}
            </Button>
            <Button
              variant="primary"
              type="submit"
              form={formId}
              icon="check"
              pending={pending}
              aria-disabled={saveBlocked}
              ref={saveRef ?? null}
            >
              {pending ? COPY.saving : saveLabel}
            </Button>
          </>
        }
      >
        <form
          id={formId}
          ref={formRef}
          noValidate
          className={orderWindowBodyClasses}
          onSubmit={(event) => {
            event.preventDefault();
            onSave();
          }}
        >
          {banner !== null && (
            <Banner
              banner={banner}
              loadingLatest={loadingLatest}
              onLoadLatest={() => {
                onLoadLatest?.();
              }}
            />
          )}
          {children}
          {recordMeta}
          <div role="status" aria-live="polite" className={srOnlyClasses}>
            {status}
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        open={asking}
        title={COPY.discard.title}
        message={COPY.discard.message}
        cancelLabel={COPY.discard.keep}
        confirmLabel={COPY.discard.discard}
        onCancel={() => {
          setAsking(false);
        }}
        onConfirm={() => {
          setAsking(false);
          onClose();
        }}
      />
    </>
  );
}
