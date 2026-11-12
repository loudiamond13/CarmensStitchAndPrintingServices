// The Public Website window of an order (UI-SPEC O1; D-09, D-11, D-13, D-16; plan 11-27): the customer's OK, Show on the website, the
// line and the name shown, for both roles. Every rule is checked in the browser first, in the server's words (OR-3); a rule only the
// server can check comes back under its field. The window sends the version of the order it opened with, so a refresh never changes
// it; a stale save keeps the typed values behind a banner (05 D-20). A save answers the whole order and the page shows it.
import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { serverFieldMessage } from '@/lib/forms/serverFieldMessage';
import type { FieldErrors } from '@/lib/forms/useSubmission';
import { OrderWindow } from '@/modules/admin/components/OrderWindow';
import { PublicWebsiteFields } from '@/modules/admin/components/PublicWebsiteFields';
import { useProductLineOptionsQuery, useSavePublicWebsite } from '@/modules/admin/hooks/usePublicWebsite';
import { ORDER_WINDOWS_COPY } from '@/modules/admin/orderWindowsCopy';
import { PUBLIC_WEBSITE_COPY } from '@/modules/admin/publicWebsiteCopy';
import {
  publicWebsiteSchema,
  type PublicWebsiteFormInput,
  type PublicWebsiteFormValues,
} from '@/modules/admin/publicWebsiteSchemas';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';

const COPY = PUBLIC_WEBSITE_COPY.window;

/** The fields in the order they appear, for the first server error to focus. */
const FIELD_ORDER = ['customerConsent', 'showOnWebsite', 'productLineId', 'publicName'] as const;
type FieldName = (typeof FIELD_ORDER)[number];

export interface PublicWebsiteModalProps {
  /** The order as the page shows it: the window opens with its version, team and public website settings. */
  order: OrderDetailResponse;
  /** False plays the close animation and then renders nothing; each new open starts clean. Default true. */
  open?: boolean;
  /** Closes the window: Cancel, Esc, the scrim and the close button (after the discard question), and after a save. */
  onClose: () => void;
  /** The settings were saved and the page already holds the answer. */
  onSaved?: ((order: OrderDetailResponse) => void) | undefined;
}

/** What the form shows for an order: the line is the one the order is shown under, else the server's auto line, else empty. */
function valuesOf(order: OrderDetailResponse): PublicWebsiteFormInput {
  const block = order.publicWebsite;
  return {
    customerConsent: block.customerConsent,
    showOnWebsite: block.shownOnWebsite,
    productLineId: block.productLineId ?? block.autoProductLineId ?? '',
    publicName: block.publicName ?? '',
  };
}

export function PublicWebsiteModal({ open = true, order, onClose, onSaved }: PublicWebsiteModalProps) {
  const [wasOpen, setWasOpen] = useState(open);
  const [opens, setOpens] = useState(0);
  // A new open mounts a fresh form: adjusted while rendering, no effect needed.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setOpens(opens + 1);
    }
  }
  return <PublicWebsiteForm key={opens} open={open} order={order} onClose={onClose} onSaved={onSaved} />;
}

interface PublicWebsiteFormProps {
  open: boolean;
  order: OrderDetailResponse;
  onClose: () => void;
  onSaved: ((order: OrderDetailResponse) => void) | undefined;
}

function PublicWebsiteForm({ open, order, onClose, onSaved }: PublicWebsiteFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  // The order the window was opened with; the version a save sends is this order's, whatever a later read brings.
  const [opened, setOpened] = useState(order);
  const options = useProductLineOptionsQuery(open);
  const hasTeam = opened.teamName !== null && opened.teamName.trim() !== '';
  const form = useForm<PublicWebsiteFormInput, unknown, PublicWebsiteFormValues>({
    resolver: zodResolver(publicWebsiteSchema(hasTeam)),
    mode: 'onBlur',
    defaultValues: valuesOf(opened),
  });
  const {
    handleSubmit,
    setError,
    reset,
    formState: { isDirty },
  } = form;

  const focusField = (name: FieldName): void => {
    const element = formRef.current?.elements.namedItem(name);
    if (element instanceof HTMLElement) {
      element.focus();
    }
  };

  const putOnFields = (errors: FieldErrors): boolean => {
    let first: FieldName | null = null;
    for (const name of FIELD_ORDER) {
      const message = serverFieldMessage(errors, name);
      if (message !== undefined) {
        setError(name, { type: 'server', message });
        first ??= name;
      }
    }
    if (first === null) {
      return false;
    }
    focusField(first);
    return true;
  };

  // Load Latest: the latest settings and version replace what was typed.
  const takeLatest = (latest: OrderDetailResponse): boolean => {
    setOpened(latest);
    reset(valuesOf(latest));
    return true;
  };

  const save = useSavePublicWebsite({
    order: opened,
    onSaved: (saved) => {
      onSaved?.(saved);
      onClose();
    },
    onFieldErrors: putOnFields,
    onLatest: takeLatest,
  });

  const onValid = (values: PublicWebsiteFormValues): void => {
    save.submit({ values, version: opened.version });
  };

  const onInvalid = (errors: Partial<Record<FieldName, unknown>>): void => {
    const first = FIELD_ORDER.find((name) => errors[name] !== undefined);
    if (first !== undefined) {
      focusField(first);
    }
  };

  const who = hasTeam && opened.teamName !== null ? opened.teamName : opened.customerName;

  return (
    <OrderWindow
      title={COPY.title}
      description={ORDER_WINDOWS_COPY.description(opened.number, who)}
      open={open}
      isDirty={isDirty}
      pending={save.pending}
      banner={save.banner}
      loadingLatest={save.loadingLatest}
      onLoadLatest={() => {
        void save.loadLatest();
      }}
      status={save.status}
      saveLabel={COPY.save}
      saveBlocked={save.saveBlocked}
      formRef={formRef}
      onSave={() => {
        void handleSubmit(onValid, onInvalid)();
      }}
      onClose={onClose}
    >
      <PublicWebsiteFields form={form} order={opened} lineOptions={options.data ?? []} showPreview />
    </OrderWindow>
  );
}
