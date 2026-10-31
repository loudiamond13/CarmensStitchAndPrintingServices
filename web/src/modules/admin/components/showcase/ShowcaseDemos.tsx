// The Component Showcase's live demos and extra cases (D-22, D-30..D-33). Fixed-position cases
// (the `viewport` scenarios: dialogs and the phone drawer) cannot sit open in a page of cases, so each one is a
// trigger that opens the real component with real handlers: Cancel, Esc and the scrim close it, focus returns to the
// trigger, and nothing is saved or deleted (the Delete Order demo only raises the spec §9.3 success toast). The extra
// cases show what no scenario does: the 56 icons with their names, the toast triggers for every tone, formatted
// dates and a loaded LazyImage.
import { useId, useState, type ComponentType } from 'react';
import { formatCalendarDate } from '@/utils/format';
import {
  Button,
  ConfirmDialog,
  Field,
  Icon,
  LazyImage,
  MobileNavDrawer,
  Modal,
  overlineClasses,
  Overlay,
  Sidebar,
  SkipLink,
  useToast,
  type Role,
  type ToastInput,
  type ToastTone,
} from '@/components';
import { ICONS, type IconName } from '@/components/brand/icons';
import { AUTH_COPY } from '@/modules/admin/authCopy';
import { SignOutDeviceDialog } from '@/modules/admin/components/SignOutDeviceDialog';
import { SignOutDialog } from '@/modules/admin/components/SignOutDialog';
import { FailedConfirmDialog } from '@/dev/previews/FailedConfirmDialog';
import { OpenedDialog } from '@/dev/previews/OpenedDialog';
import { LONG_DEVICE_LABEL, SAMPLE_DEVICE } from '@/dev/previews/SessionScreens';
import { serverError } from '@/dev/previews/serverError';
import { scenarioById } from '@/dev/scenarios';
import {
  dateClasses,
  datesClasses,
  iconCellClasses,
  iconGridClasses,
  iconNameClasses,
  loadedImageClasses,
  triggersClasses,
} from './showcase.recipe';
import { Phase5Demos } from './Phase5Demos';
import { Phase6Demos } from './Phase6Demos';
import { Phase8Demos } from './Phase8Demos';
import { SHOWCASE_COPY } from './showcaseCopy';
import type { ShowcaseSectionId } from './showcaseSections';

const MANAGER: Role = 'manager';
const CARMEN = { name: 'Carmen Reyes' };
const ORDER = 'ORD-2026-0148';

/** The App. E.8/E.10 order delete (spec §9.3 copy), as the overlays scenarios show it. */
const DELETE_ORDER = {
  title: `Delete order ${ORDER}?`,
  message:
    'Brgy. San Roque Ballers · Juan Dela Cruz. The order will be permanently deleted along with everything inside it.',
  counts: { items: 5, payments: 2, discounts: 1, expenses: 3, images: 4 },
  confirmText: ORDER,
  confirmLabel: 'Delete Order',
} as const;

/** The child-row delete (spec "Deleting a child row": title, message and confirm label for a ₱2,000.00 payment). */
const DELETE_PAYMENT = {
  title: 'Delete payment of ₱2,000.00?',
  message: `This removes it from ${ORDER} and updates the totals right away.`,
  confirmLabel: 'Delete Payment',
} as const;

/** The reference the failed-delete demo's error carries (as in the confirm-delete-order-error scenario). */
const FAILED_TRACE_ID = '00-4bf92f3577b34da6a3ce929d0e0e4736-01';

/** Open/close state for one demo. */
function useOpen(): readonly [boolean, () => void, () => void] {
  const [open, setOpen] = useState(false);
  return [
    open,
    () => {
      setOpen(true);
    },
    () => {
      setOpen(false);
    },
  ];
}

function AddPaymentDemo() {
  const [open, show, close] = useOpen();
  return (
    <>
      <Button variant="secondary" onClick={show}>
        {SHOWCASE_COPY.openAddPayment}
      </Button>
      <Modal
        open={open}
        title="Add Payment"
        description={`${ORDER} · Brgy. San Roque Ballers`}
        onClose={close}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" icon="check" onClick={close}>
              Add Payment
            </Button>
          </>
        }
      >
        <Field label="Amount" prefix="₱" inputMode="decimal" autoComplete="off" hint="Balance due: ₱4,327.50" />
      </Modal>
    </>
  );
}

function AddUserDemo() {
  const [open, show, close] = useOpen();
  return (
    <>
      <Button variant="secondary" onClick={show}>
        {SHOWCASE_COPY.openAddUser}
      </Button>
      <Modal
        open={open}
        variant="slideover"
        title="Add User"
        description="They can sign in right away with a temporary password."
        onClose={close}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" icon="check" onClick={close}>
              Create User
            </Button>
          </>
        }
      >
        <Field label="First name" autoComplete="off" />
      </Modal>
    </>
  );
}

type DeleteOrderMode = 'plain' | 'typed' | 'failed';

/** The order delete: `typed` opens with the order number typed; `failed` opens on an action that fails (HTTP 500). */
function DeleteOrderDemo({ mode }: { mode: DeleteOrderMode }) {
  const [open, show, close] = useOpen();
  const toast = useToast();
  const confirm = () => {
    close();
    toast.show({ tone: 'success', ...SHOWCASE_COPY.deletedToast });
  };
  let dialog = null;
  if (open && mode === 'failed') {
    dialog = (
      <Overlay>
        <FailedConfirmDialog {...DELETE_ORDER} inline traceId={FAILED_TRACE_ID} onCancel={close} />
      </Overlay>
    );
  } else if (open) {
    dialog = (
      <OpenedDialog {...(mode === 'typed' ? { typed: ORDER } : {})}>
        <Overlay>
          <ConfirmDialog {...DELETE_ORDER} inline onConfirm={confirm} onCancel={close} />
        </Overlay>
      </OpenedDialog>
    );
  }
  return (
    <>
      <Button variant="danger" icon="trash-2" onClick={show}>
        {SHOWCASE_COPY.openDeleteOrder}
      </Button>
      {dialog}
    </>
  );
}

/**
 * The child-row delete (CSPS-UI-SPEC "Deleting a child row", the payment example): a ConfirmDialog with no
 * type-to-confirm field, so Cancel takes the focus when it opens (A11Y-02). Delete Payment only closes it; nothing is
 * deleted. Plan 02-35 added it for the keyboard journey, because every other confirm demo has the field.
 */
function DeletePaymentDemo() {
  const [open, show, close] = useOpen();
  return (
    <>
      <Button variant="danger" icon="trash-2" onClick={show}>
        {SHOWCASE_COPY.openDeletePayment}
      </Button>
      {open && (
        <Overlay>
          <ConfirmDialog {...DELETE_PAYMENT} inline onConfirm={close} onCancel={close} />
        </Overlay>
      )}
    </>
  );
}

function NavDrawerDemo() {
  const [open, show, close] = useOpen();
  const drawerId = useId();
  return (
    <>
      <Button variant="secondary" icon="menu" aria-controls={drawerId} aria-expanded={open} onClick={show}>
        {SHOWCASE_COPY.openDrawer}
      </Button>
      <MobileNavDrawer id={drawerId} open={open} onClose={close}>
        <Sidebar active="dashboard" role={MANAGER} user={CARMEN} />
      </MobileNavDrawer>
    </>
  );
}

/**
 * The sign-out dialogs (plan 04-32): real dialogs with demo requests. "Sign Out Other Devices" and "Sign Out Device" end
 * nothing here, because the showcase runs inside a real session: the confirm only waits a moment and closes, or (the
 * "fails" demos) fails with a 500 and its reference, so the failure line shows.
 */
function SignOutDemo({ kind, fails }: { kind: 'others' | 'device'; fails: boolean }) {
  const [open, show, close] = useOpen();
  const confirm = () =>
    fails
      ? Promise.reject(serverError(FAILED_TRACE_ID))
      : new Promise<undefined>((resolve) => {
          window.setTimeout(() => {
            close();
            resolve(undefined);
          }, 400);
        });
  const others = AUTH_COPY.signOutOthersDialog;
  let label: string = SHOWCASE_COPY.openSignOutDevice;
  if (kind === 'others') {
    label = fails ? SHOWCASE_COPY.openSignOutOthersFailed : SHOWCASE_COPY.openSignOutOthers;
  } else if (fails) {
    label = SHOWCASE_COPY.openSignOutDeviceFailed;
  }
  let dialog = null;
  if (open && kind === 'others') {
    dialog = (
      <SignOutDialog
        title={others.title}
        message={others.body}
        keepLabel={others.keep}
        confirmLabel={others.confirm}
        pendingLabel={others.pending}
        onConfirm={confirm}
        onCancel={close}
      />
    );
  } else if (open) {
    dialog = <SignOutDeviceDialog device={SAMPLE_DEVICE} onConfirm={confirm} onCancel={close} />;
  }
  return (
    <>
      <Button variant="secondary" size="sm" icon="log-out" onClick={show}>
        {label}
      </Button>
      {dialog}
    </>
  );
}

/** One trigger per session toast: the session-cap warning and the S7 and password toasts, with the app's own copy. */
function SessionToastTriggers() {
  const toast = useToast();
  const copy = AUTH_COPY.toasts;
  const inputs: Readonly<Record<string, ToastInput>> = {
    'session-ending': {
      tone: 'warning',
      title: copy.sessionEnding.title,
      message: copy.sessionEnding.body('3:42 PM'),
    },
    'device-signed-out': {
      tone: 'success',
      title: copy.deviceSignedOut.title,
      message: copy.deviceSignedOut.body(LONG_DEVICE_LABEL),
    },
    'already-signed-out': { tone: 'info', title: copy.alreadySignedOut.title, message: copy.alreadySignedOut.body },
    'signed-out-others': { tone: 'success', title: copy.signedOutOthers.title, message: copy.signedOutOthers.body },
    'password-saved': { tone: 'success', title: copy.passwordSaved.title, message: copy.passwordSaved.body },
  };
  return (
    <div className={triggersClasses}>
      {SHOWCASE_COPY.sessionToastTriggers.map(([label, id]) => (
        <Button
          key={id}
          variant="secondary"
          size="sm"
          onClick={() => {
            const input = inputs[id];
            if (input !== undefined) {
              toast.show(input);
            }
          }}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

/** The live demo shown in place of each fixed-position (viewport) scenario. */
export const VIEWPORT_DEMOS: Readonly<Record<string, ComponentType>> = {
  'modal-add-payment': AddPaymentDemo,
  'modal-slideover': AddUserDemo,
  'confirm-delete-order': () => <DeleteOrderDemo mode="plain" />,
  'confirm-delete-order-typed': () => <DeleteOrderDemo mode="typed" />,
  'confirm-delete-order-error': () => <DeleteOrderDemo mode="failed" />,
  'drawer-open': NavDrawerDemo,
  'signout-others-open': () => <SignOutDemo kind="others" fails={false} />,
  'signout-others-failed': () => <SignOutDemo kind="others" fails />,
  'signout-device-open': () => <SignOutDemo kind="device" fails={false} />,
  'signout-device-failed': () => <SignOutDemo kind="device" fails />,
};

/**
 * Block scenarios shown differently here: the skip-link-focused wrapper (FocusedSkipLink) focuses its link on load and
 * renders a second `main#main`, so the showcase shows the SkipLink alone. Keyboard users reach it with Tab; it then
 * shows at the top left of its frame and moves focus to the shell's main.
 */
export const BLOCK_REPLACEMENTS: Readonly<Record<string, ComponentType>> = {
  'skip-link-focused': () => <SkipLink />,
};

const TONES: readonly ToastTone[] = ['success', 'info', 'warning', 'danger'];

function isToastTone(value: unknown): value is ToastTone {
  return TONES.some((tone) => tone === value);
}

/** The tone, title and message of a toast scenario. */
function toastOf(id: string): ToastInput {
  const { tone, title, message } = scenarioById(id).node.props ?? {};
  if (!isToastTone(tone) || typeof title !== 'string' || typeof message !== 'string') {
    throw new Error(`Scenario "${id}" is not a toast with a tone, a title and a message.`);
  }
  return { tone, title, message };
}

/** One trigger per toast scenario; the toast appears in the admin shell's toast layer. */
function ToastTriggers() {
  const toast = useToast();
  return (
    <div className={triggersClasses}>
      {SHOWCASE_COPY.toastTriggers.map(([label, id]) => (
        <Button
          key={id}
          variant="secondary"
          size="sm"
          onClick={() => {
            toast.show(toastOf(id));
          }}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

const ICON_NAMES = Object.keys(ICONS) as IconName[];

function IconNames() {
  return (
    <ul className={iconGridClasses}>
      {ICON_NAMES.map((name) => (
        <li key={name} className={iconCellClasses}>
          <Icon name={name} />
          <span className={iconNameClasses}>{name}</span>
        </li>
      ))}
    </ul>
  );
}

/** The ORD-2026-0148 ordered and due dates (spec §12.2), as `formatCalendarDate` writes date-only fields. */
function Dates() {
  return (
    <dl className={datesClasses}>
      <div className={dateClasses}>
        <dt className={overlineClasses}>{SHOWCASE_COPY.dates.ordered}</dt>
        <dd>{formatCalendarDate('2026-09-28')}</dd>
      </div>
      <div className={dateClasses}>
        <dt className={overlineClasses}>{SHOWCASE_COPY.dates.due}</dt>
        <dd>{formatCalendarDate('2026-10-14')}</dd>
      </div>
    </dl>
  );
}

function LoadedLazyImage() {
  return (
    <LazyImage
      src="/mark.svg"
      alt={SHOWCASE_COPY.markAlt}
      width={512}
      height={512}
      ratio="1 / 1"
      className={loadedImageClasses}
    />
  );
}

export interface ExtraCase {
  readonly id: string;
  readonly Component: ComponentType;
  /** A live demo that opens a fixed layer: its frame is no page root, so the layer covers the page. */
  readonly demo?: boolean;
}

/** Cases no scenario has, shown at the end of their section. */
export const EXTRA_CASES: Readonly<Partial<Record<ShowcaseSectionId, readonly ExtraCase[]>>> = {
  brand: [{ id: 'showcase-icon-names', Component: IconNames }],
  data: [{ id: 'showcase-dates', Component: Dates }],
  feedback: [
    { id: 'showcase-toast-triggers', Component: ToastTriggers },
    { id: 'showcase-confirm-delete-payment', Component: DeletePaymentDemo, demo: true },
  ],
  media: [{ id: 'showcase-lazy-image-loaded', Component: LoadedLazyImage }],
  auth: [{ id: 'showcase-session-toasts', Component: SessionToastTriggers }],
  staff: [{ id: 'showcase-staff-and-audit', Component: Phase5Demos, demo: true }],
  expenses: [{ id: 'showcase-company-expenses', Component: Phase6Demos, demo: true }],
  orders: [{ id: 'showcase-orders', Component: Phase8Demos, demo: true }],
};
