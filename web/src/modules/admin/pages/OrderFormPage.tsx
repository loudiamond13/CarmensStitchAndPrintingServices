// F1 New Order, /admin/orders/new (ORD-03, ORD-04, ORD-15, D-09, D-27, D-28, D-30, D-49, D-59; plans 08-13 and 09-21). Customer and
// order details, the Images card (the draft photo picker), the items and one save that sends them together. Picked photos stay on
// the form; once the order exists they go to its upload queue and the order page shows them uploading. Every server rule is
// checked in the browser first with the server's own words (OR-3). One Idempotency-Key covers a submission and its retries (SEC-06). The order date starts at the
// server's business today; the device clock is never read (D-59). F1 and F2 also carry the Public website card (plan 11-35): its four
// values live in this form and save with the order. With `?fromRequest={id}` the form starts from that quote request and the save
// converts it (UI-SPEC R3, D-20).
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useEffect, useId, useRef, useState, type ReactNode, type SyntheticEvent } from 'react';
import { Controller, useForm, useWatch, type FieldPath } from 'react-hook-form';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { Button, ButtonLink, UiLink, hitAreaClasses } from '@/components/actions';
import { Icon } from '@/components/brand';
import { Select } from '@/components/forms';
import { useToast } from '@/components/feedback';
import {
  loginBackClasses,
  pageHeadClasses,
  pageHeadTitleClasses,
  pageSublineClasses,
  pageTitleClasses,
  srOnlyClasses,
} from '@/components/layout/layout.recipe';
import { ConfirmDialog } from '@/components/overlays';
import { ConflictBanner, ErrorState, LoadingRegion, Note, SkeletonCard, SkeletonText } from '@/components/states';
import { bannerStartClasses, bannerTextClasses } from '@/components/states/states.recipe';
import { isHttpError } from '@/core/api/errors';
import { describeHttpError } from '@/utils/describeHttpError';
import { focusFirstInvalid } from '@/lib/forms/focusFirstInvalid';
import { mayHaveSaved } from '@/lib/forms/mayHaveSaved';
import { useSubmission } from '@/lib/forms/useSubmission';
import {
  OrderFormCustomerCard,
  OrderFormDetailsCard,
  type OrderDetailsControl,
} from '@/modules/admin/components/OrderDetailsCards';
import { OrderEditAside } from '@/modules/admin/components/OrderEditAside';
import {
  DraftDescriptionWindow,
  OrderPhotoPicker,
  useDraftPhotos,
  type OrderPhotoPickerHandle,
} from '@/modules/admin/components/OrderPhotoPicker';
import { OrderLockedBanner } from '@/modules/admin/components/OrderLockedBanner';
import { OrderFormSaveBar, saveBarCaption } from '@/modules/admin/components/OrderFormSaveBar';
import { OrderItemsEditor } from '@/modules/admin/components/OrderItemsEditor';
import { OrderSummaryAside } from '@/modules/admin/components/OrderSummaryAside';
import type { PublicWebsiteFormLike } from '@/modules/admin/components/PublicWebsiteFields';
import { PublicWebsiteFormCard } from '@/modules/admin/components/PublicWebsiteFormCard';
import {
  orderFormBannerClasses,
  orderFormCardClasses,
  orderFormCardHeadClasses,
  orderFormCardHintClasses,
  orderFormCardTitleClasses,
  orderFormColClasses,
  orderFormConvertedClasses,
  orderFormLayoutClasses,
  orderFormPageClasses,
  orderFormToastLineClasses,
} from '@/modules/admin/components/orderForm.recipe';
import { orderBackRowClasses } from '@/modules/admin/components/orderPage.recipe';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { useApplyOrder, useRefetchOrder } from '@/modules/admin/hooks/useApplyOrder';
import { orderKey, useOrderQuery } from '@/modules/admin/hooks/useOrderQuery';
import { photoUploadQueue, type UploadDeps } from '@/modules/admin/hooks/usePhotoUploadQueue';
import { isQuoteRequestId, quoteRequestKey } from '@/modules/admin/hooks/useQuoteRequestQuery';
import { quoteRequestsKey } from '@/modules/admin/hooks/useQuoteRequestsQuery';
import { useRefreshOrders } from '@/modules/admin/hooks/useRefreshOrders';
import { useBusinessTodayState } from '@/modules/admin/hooks/useBusinessToday';
import { useUnsavedChangesGuard } from '@/modules/admin/hooks/useUnsavedChangesGuard';
import { ORDER_FORM_COPY } from '@/modules/admin/orderFormCopy';
import { useItemsPreview } from '@/modules/admin/orderFormPreview';
import {
  blankOrderItem,
  CREATE_STATUSES,
  createOrderSchema,
  toCreateOrderRequest,
  type CreateOrderFormInput,
  toUpdateOrderDetailsRequest,
  updateOrderDetailsSchema,
  type CreateOrderFormValues,
  type UpdateOrderDetailsFormInput,
  type UpdateOrderDetailsFormValues,
} from '@/modules/admin/orderFormSchemas';
import { backTarget, ORDERS_PATH } from '@/modules/admin/orderNavigation';
import { ORDER_PAGE_COPY } from '@/modules/admin/orderPageCopy';
import { ORDER_PHOTOS_COPY } from '@/modules/admin/orderPhotosCopy';
import { isLocked } from '@/modules/admin/orderRules';
import { QUOTE_REQUESTS_PATH } from '@/modules/admin/quoteRequestNavigation';
import { blankPublicWebsite, publicWebsiteValuesOf } from '@/modules/admin/publicWebsiteSchemas';
import { orderStateActionClasses } from '@/modules/admin/components/orderPage.recipe';
import { orderPhotosService } from '@/modules/admin/services/orderPhotosService';
import { ordersService, type OrderDetailResponse } from '@/modules/admin/services/ordersService';
import {
  quoteRequestsService,
  type OrderPrefill,
  type QuoteRequestDetailResponse,
} from '@/modules/admin/services/quoteRequestsService';
import { ORDER_STATUSES, type OrderStatus } from '@/utils/csps';
import { formatCalendarDate } from '@/utils/format';
import { isCalendarDate } from '@/lib/url-state/parsers';

const COPY = ORDER_FORM_COPY;
const PHOTOS = ORDER_PHOTOS_COPY;

/** The server's code for "saving is busy, nothing was saved". */
const ORDERS_BUSY = 'orders.busy';

/** The server's codes for a quote request a save cannot convert: gone, or already an order (D-23). */
const REQUEST_NOT_FOUND = 'quote-requests.not-found';
const ALREADY_CONVERTED = 'quote-requests.already-converted';

/** The server's code for "someone saved this order since the form opened" (05 D-20). */
const EDIT_STALE = 'edit.stale';

/** The server's code for "the order is Completed or Cancelled" (D-15). */
const ORDERS_LOCKED = 'orders.locked';

/** The server's code for "a Cancelled order cannot be shown on the website": the order was cancelled since the form opened. */
const ORDERS_PUBLIC_CANCELLED = 'orders.public-cancelled';

const STATUS_OPTIONS = CREATE_STATUSES.map((status) => ({
  value: status,
  label: ORDER_STATUSES[status as OrderStatus],
}));

const MS_PER_DAY = 86_400_000;

/** Whole days from one `yyyy-MM-dd` date to a later one; null unless both are real and in order. */
function daysBetween(from: string, to: string): number | null {
  if (!isCalendarDate(from) || !isCalendarDate(to) || to < from) return null;
  const day = (ymd: string): number => {
    const [year = 0, month = 1, date = 1] = ymd.split('-').map(Number);
    return Date.UTC(year, month - 1, date);
  };
  return Math.round((day(to) - day(from)) / MS_PER_DAY);
}

/** How many fields the form flags: every leaf error, an item field or the items list itself. */
function countErrors(errors: unknown): number {
  if (typeof errors !== 'object' || errors === null) return 0;
  if ('type' in errors && 'message' in errors && typeof errors.message === 'string') return 1;
  return Object.entries(errors).reduce((sum, [key, value]) => (key === 'ref' ? sum : sum + countErrors(value)), 0);
}

/** The detail fields both forms hold, by the lower-cased key the server uses. */
const DETAIL_FIELDS: Readonly<Record<string, FieldPath<UpdateOrderDetailsFormInput>>> = {
  customername: 'customerName',
  teamname: 'teamName',
  contactnumber: 'contactNumber',
  email: 'email',
  address: 'address',
  orderdate: 'orderDate',
  duedate: 'dueDate',
  notes: 'notes',
  // The Public website card, which the server answers under the publicWebsite. prefix.
  'publicwebsite.customerconsent': 'customerConsent',
  'publicwebsite.showonwebsite': 'showOnWebsite',
  'publicwebsite.productlineid': 'productLineId',
  'publicwebsite.publicname': 'publicName',
};

const TOP_FIELDS: Readonly<Record<string, FieldPath<CreateOrderFormInput>>> = {
  ...DETAIL_FIELDS,
  status: 'status',
  items: 'items.root' as FieldPath<CreateOrderFormInput>,
};

const ITEM_FIELDS: Readonly<Record<string, string>> = {
  producttypeid: 'productTypeId',
  description: 'description',
  sizevariant: 'sizeVariant',
  quantity: 'quantity',
  unitprice: 'unitPrice',
};

/** The form field a server key names ("customerName", "items[1].quantity"), or null when no rendered field matches. */
function serverFieldPath(key: string, rows: number): FieldPath<CreateOrderFormInput> | null {
  const lower = key.toLowerCase();
  const top = TOP_FIELDS[lower];
  if (top !== undefined) return top;
  const match = /^items\[(\d+)\]\.(\w+)$/.exec(lower);
  const field = match?.[2] === undefined ? undefined : ITEM_FIELDS[match[2]];
  const row = Number(match?.[1]);
  return field !== undefined && row < rows
    ? (`items.${String(row)}.${field}` as FieldPath<CreateOrderFormInput>)
    : null;
}

interface Banner {
  title: string;
  message: string;
}

interface CreateOrderFormProps {
  /** The server's business today: the order date starts here (D-59). */
  today: string;
  /** The quote request the form was opened from (D-20): its values are the form's starting point. */
  prefill?: OrderPrefill | undefined;
  /** The form was opened from a quote request that is gone, so it is blank. */
  requestMissing?: boolean | undefined;
  /** The order this tab already read the request as Converted to: the box above Save shows from the start. */
  converted?: ExistingOrder | null | undefined;
}

/** The order a quote request already became (409 quote-requests.already-converted); null members when the server named none. */
interface ExistingOrder {
  id: string | null;
  number: string | null;
}

/** One save: the checked values and the quote request it converts, or null for a plain order. */
interface CreateSubmission {
  values: CreateOrderFormValues;
  quoteRequestId: string | null;
}

function CreateOrderForm({ today, prefill, requestMissing = false, converted = null }: CreateOrderFormProps) {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const applyOrder = useApplyOrder();
  const refetchOrder = useRefetchOrder();
  const refreshOrders = useRefreshOrders();
  const queryClient = useQueryClient();
  const backTo = backTarget(location.state);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [focusTick, setFocusTick] = useState(0);
  // The photos picked for the new order; the store's latest list is what the save hands on, after its awaits.
  const drafts = useDraftPhotos();
  const pickerRef = useRef<OrderPhotoPickerHandle>(null);
  // The draft whose description window is open.
  const [describing, setDescribing] = useState<string | null>(null);
  // The quote request a save converts (D-20).
  const [linkedRequest, setLinkedRequest] = useState<string | null>(prefill?.quoteRequestId ?? null);
  // Another save converted the request first: the box above Save names that order.
  const [existing, setExisting] = useState<ExistingOrder | null>(converted);
  // A save found the request deleted: the note keeps its words but no longer links to it.
  const [requestGone, setRequestGone] = useState(false);

  const {
    control,
    handleSubmit,
    setError,
    setValue,
    getValues,
    formState: { errors, isDirty },
  } = useForm<CreateOrderFormInput, unknown, CreateOrderFormValues>({
    resolver: zodResolver(createOrderSchema),
    mode: 'onBlur',
    // A prefill is the starting point, so an untouched prefilled form is not dirty (UI-SPEC R3).
    defaultValues: {
      customerName: prefill?.customerName ?? '',
      teamName: prefill?.teamName ?? '',
      contactNumber: prefill?.contactNumber ?? '',
      email: prefill?.email ?? '',
      address: '',
      orderDate: today,
      dueDate: '',
      status: 'pending',
      notes: prefill?.notes ?? '',
      items: [{ ...blankOrderItem(), productTypeId: prefill?.productTypeId ?? '' }],
      ...blankPublicWebsite(),
    },
  });

  // The shared cards read only the detail fields, which this form holds with the same names and types. Control is invariant in its
  // field values, so the wider control is narrowed here, once.
  const detailsControl = control as unknown as OrderDetailsControl;
  // The Public website card reads and writes its four values on this form, so it takes the same narrowing.
  const publicForm = { control, setValue } as unknown as PublicWebsiteFormLike;
  const hasChanges = isDirty || drafts.drafts.length > 0;
  const guard = useUnsavedChangesGuard({ isDirty: hasChanges });
  const [orderDate, dueDate, status, teamName] = useWatch({
    control,
    name: ['orderDate', 'dueDate', 'status', 'teamName'],
  });
  const preview = useItemsPreview(control);
  const days = daysBetween(orderDate, dueDate);

  // Focus goes to the first flagged field once the messages are on screen.
  useEffect(() => {
    if (focusTick > 0 && formRef.current !== null) {
      focusFirstInvalid(formRef.current);
    }
  }, [focusTick]);

  const showFailure = (error: unknown, copy: { title: string; body: string }): void => {
    // A failure that may have saved (a server error, a timeout, no answer) leaves the lists and the money old, so they are read again.
    if (mayHaveSaved(error)) {
      void refreshOrders();
    }
    if (isHttpError(error) && error.status === 409 && error.code === ORDERS_BUSY) {
      setBanner({ title: COPY.busy.title, message: COPY.busy.message });
      return;
    }
    // Nothing was saved and every value stays; the request changed, so its page, the inbox and the New count read again.
    if (isHttpError(error) && error.status === 409 && error.code === ALREADY_CONVERTED) {
      void queryClient.invalidateQueries({ queryKey: quoteRequestsKey });
      setExisting({ id: error.problem?.orderId ?? null, number: error.problem?.orderNumber ?? null });
      return;
    }
    if (isHttpError(error) && error.status === 404 && error.code === REQUEST_NOT_FOUND) {
      void queryClient.invalidateQueries({ queryKey: quoteRequestsKey });
      setLinkedRequest(null);
      setRequestGone(true);
      setBanner({ title: COPY.fromRequest.gone.title, message: COPY.fromRequest.gone.message });
      return;
    }
    if (isHttpError(error) && error.status === 400) {
      const rows = getValues('items').length;
      let matched = false;
      for (const [key, messages] of Object.entries(error.fieldErrors)) {
        const path = serverFieldPath(key, rows);
        const message = messages[0];
        if (path !== null && message !== undefined) {
          setError(path, { type: 'server', message });
          matched = true;
        }
      }
      if (matched) {
        setFocusTick((tick) => tick + 1);
      } else {
        // No rendered field matches: say what the server said.
        const first = Object.values(error.fieldErrors)[0]?.[0];
        setBanner({ title: first ?? copy.title, message: first === undefined ? copy.body : '' });
      }
      return;
    }
    toast.show({ tone: 'danger', title: copy.title, message: copy.body });
  };

  /** What the new order's queue needs to upload the drafts: the same reactions as the order page's Images card. */
  const uploadDeps = (orderId: string): UploadDeps => ({
    upload: (id, item, signal) =>
      orderPhotosService.upload(id, item.blob, item.name, item.description, item.key, signal),
    onSaved: applyOrder,
    onLocked: (message) => {
      void refetchOrder(orderId);
      toast.show({ tone: 'danger', title: PHOTOS.toasts.changeFailed.title, message });
    },
    onBatchDone: (count) => {
      const number = queryClient.getQueryData<OrderDetailResponse>(orderKey(orderId))?.number ?? '';
      toast.show({
        tone: 'success',
        title: PHOTOS.toasts.added.title,
        message: PHOTOS.toasts.added.message(count, number),
      });
    },
  });

  const submission = useSubmission<CreateSubmission, OrderDetailResponse>(
    (key, { values, quoteRequestId }) =>
      ordersService.create(
        quoteRequestId === null ? toCreateOrderRequest(values) : { ...toCreateOrderRequest(values), quoteRequestId },
        key,
      ),
    {
      onSuccess: (order, { quoteRequestId }) => {
        applyOrder(order);
        // The order exists, so its photos go to its queue in their draft order, keyed by the new id (T-09-50, D-28).
        photoUploadQueue.enqueue(
          order.id,
          drafts.read().map((draft) => ({
            blob: draft.blob,
            name: draft.name,
            description: draft.description,
            preview: draft.preview,
            previewUnavailable: draft.previewUnavailable,
          })),
          uploadDeps(order.id),
        );
        // The saved form must not hold its own way to the new order.
        guard.allowLeave();
        // A form filled from a request leaves the history, so Back cannot fill it again for a Converted request (W10 WR-01).
        void navigate(`/admin/orders/${order.id}`, prefill === undefined ? undefined : { replace: true });
        const who = order.teamName !== null && order.teamName !== '' ? order.teamName : order.customerName;
        const saved = COPY.toast.message(order.number, who);
        let message: ReactNode = saved;
        if (quoteRequestId !== null) {
          // The request is Converted now: its page, the inbox lists and the New count read again (D-14).
          void queryClient.invalidateQueries({ queryKey: quoteRequestsKey });
          message = (
            <>
              {saved}
              <span className={orderFormToastLineClasses}>{COPY.toast.converted}</span>
            </>
          );
        }
        toast.show({ title: COPY.toast.title, message });
      },
      onFailure: (copy, error) => {
        showFailure(error, copy);
      },
    },
  );
  const { pending } = submission;

  const submitWith = async (values: CreateOrderFormValues, quoteRequestId: string | null): Promise<void> => {
    setBanner(null);
    // The box stays through its own unlinked save, so focus stays on its button.
    if (quoteRequestId !== null) setExisting(null);
    // A photo still being prepared joins the order first.
    await pickerRef.current?.settled();
    await submission.submit({ values, quoteRequestId });
  };

  const onValid = (values: CreateOrderFormValues): Promise<void> => submitWith(values, linkedRequest);

  /** D-23: the typed order is saved as a normal order. The data differs from the linked save, so it gets a new Idempotency-Key. */
  const saveUnlinked = (): void => {
    setLinkedRequest(null);
    void handleSubmit((values) => submitWith(values, null), onInvalid)();
  };

  const onInvalid = (): void => {
    setFocusTick((tick) => tick + 1);
  };

  const itemsError = errors.items?.root?.message ?? errors.items?.message;
  const flagged = countErrors(errors);
  const caption = saveBarCaption(pending, flagged, hasChanges);

  return (
    <div className={orderFormPageClasses} data-savebar="">
      <div className={pageHeadClasses}>
        <div className={pageHeadTitleClasses}>
          <div className={orderBackRowClasses}>
            <UiLink to={backTo} className={clsx(loginBackClasses, hitAreaClasses)}>
              <Icon name="chevron-left" size={16} />
              {COPY.back}
            </UiLink>
          </div>
          <h1 className={pageTitleClasses}>{COPY.title}</h1>
          <p className={pageSublineClasses}>{COPY.subline}</p>
        </div>
      </div>
      <form
        id={formId}
        ref={formRef}
        noValidate
        className={orderFormLayoutClasses}
        onSubmit={(event: SyntheticEvent<HTMLFormElement>) => {
          void handleSubmit(onValid, onInvalid)(event);
        }}
      >
        <div className={orderFormColClasses}>
          {requestMissing && <Note icon="info">{COPY.fromRequest.notFound}</Note>}
          {prefill !== undefined && (
            <Note icon="info">
              {COPY.fromRequest.note(
                prefill.customerName,
                formatCalendarDate(prefill.receivedOn) ?? prefill.receivedOn,
              )}
              {!requestGone && (
                <>
                  {' '}
                  <UiLink to={`${QUOTE_REQUESTS_PATH}/${encodeURIComponent(prefill.quoteRequestId)}`}>
                    {COPY.fromRequest.viewRequest}
                  </UiLink>
                </>
              )}
            </Note>
          )}
          {banner !== null && (
            <div className={orderFormBannerClasses}>
              <ErrorState title={banner.title} message={banner.message} align="start" />
            </div>
          )}
          <OrderFormCustomerCard control={detailsControl} headingId={`${formId}-customer`} />
          <OrderFormDetailsCard
            control={detailsControl}
            headingId={`${formId}-details`}
            dueHint={days === null ? undefined : COPY.details.dueHint(days)}
            statusField={
              <Controller
                control={control}
                name="status"
                render={({ field, fieldState }) => (
                  <Select
                    label={COPY.details.status}
                    hint={COPY.details.statusHint}
                    name={field.name}
                    options={STATUS_OPTIONS}
                    value={field.value}
                    onChange={(event) => {
                      field.onChange(event.target.value);
                    }}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message ?? ''}
                    required
                  />
                )}
              />
            }
          />
          <PublicWebsiteFormCard
            form={publicForm}
            order={null}
            teamName={teamName}
            headingId={`${formId}-public`}
            lineFromItems
          />
          <section className={orderFormCardClasses} aria-labelledby={`${formId}-images`}>
            <div className={orderFormCardHeadClasses}>
              <div>
                <h2 id={`${formId}-images`} className={orderFormCardTitleClasses}>
                  {PHOTOS.title}
                </h2>
                <p className={orderFormCardHintClasses}>{PHOTOS.hints.draft}</p>
              </div>
            </div>
            <OrderPhotoPicker store={drafts} onEditDescription={setDescribing} handleRef={pickerRef} />
          </section>
          <OrderItemsEditor control={control} rootError={itemsError} />
          {existing !== null && (
            <div className={bannerStartClasses} role="alert">
              <Icon name="triangle-alert" size={20} />
              <div className={clsx(bannerTextClasses, orderFormConvertedClasses)}>
                <strong>
                  {existing.number === null
                    ? COPY.fromRequest.alreadyConvertedNoNumber
                    : COPY.fromRequest.alreadyConverted(existing.number)}
                </strong>
                {existing.id !== null && existing.number !== null && (
                  <UiLink to={`${ORDERS_PATH}/${encodeURIComponent(existing.id)}`} className={hitAreaClasses}>
                    {COPY.fromRequest.openOrder(existing.number)}
                  </UiLink>
                )}
                <Button variant="ghost" onClick={saveUnlinked} loading={pending}>
                  {COPY.fromRequest.saveAsNew}
                </Button>
              </div>
            </div>
          )}
          <OrderFormSaveBar
            caption={caption}
            saveLabel={COPY.saveBar.save}
            pending={pending}
            onCancel={() => void navigate(backTo)}
          />
        </div>
        <OrderSummaryAside
          status={status}
          dueDate={dueDate}
          lineItems={preview.lines}
          pieces={preview.pieces}
          total={preview.subtotal}
        />
      </form>
      {/* The window has a form of its own, so it sits beside the order form, never inside it. */}
      <DraftDescriptionWindow
        store={drafts}
        editingId={describing}
        onClose={() => {
          setDescribing(null);
        }}
      />
      <ConfirmDialog
        open={guard.dialog.open}
        title={COPY.discard.title}
        message={COPY.discard.message}
        cancelLabel={COPY.discard.keep}
        confirmLabel={COPY.discard.discard}
        onConfirm={guard.dialog.onDiscard}
        onCancel={guard.dialog.onKeepEditing}
        loading={pending}
      />
    </div>
  );
}

/** What the edit form shows for a saved order: every control is text, and an empty value is an empty box. */
function valuesOf(order: OrderDetailResponse): UpdateOrderDetailsFormInput {
  return {
    customerName: order.customerName,
    teamName: order.teamName ?? '',
    contactNumber: order.contactNumber ?? '',
    email: order.email ?? '',
    address: order.address ?? '',
    orderDate: order.orderDate,
    dueDate: order.dueDate ?? '',
    notes: order.notes ?? '',
    ...publicWebsiteValuesOf(order),
  };
}

interface EditOrderFormProps {
  /** The order as it was read when the form opened: the version a save sends is this one's, whatever a later refetch brings. */
  initial: OrderDetailResponse;
}

function EditOrderForm({ initial }: EditOrderFormProps) {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const navigate = useNavigate();
  const toast = useToast();
  const applyOrder = useApplyOrder();
  const refetchOrder = useRefetchOrder();
  const refreshOrders = useRefreshOrders();
  // The order the form was filled from. A refetch behind the form never changes it; only Load Latest does.
  const [opened, setOpened] = useState(initial);
  const orderPath = `${ORDERS_PATH}/${opened.id}`;
  const query = useOrderQuery(opened.id);
  const [focusTick, setFocusTick] = useState(0);
  // How many stale saves the server has refused since the form was last current; the banner shows from the first.
  const [conflicts, setConflicts] = useState(0);
  const [loadingLatest, setLoadingLatest] = useState(false);
  // The order was deleted while the form was open (404).
  const [gone, setGone] = useState(false);
  // The polite line read out after Load Latest.
  const [announcement, setAnnouncement] = useState('');

  const {
    control,
    handleSubmit,
    setError,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm<UpdateOrderDetailsFormInput, unknown, UpdateOrderDetailsFormValues>({
    resolver: zodResolver(updateOrderDetailsSchema),
    mode: 'onBlur',
    defaultValues: valuesOf(opened),
  });

  const guard = useUnsavedChangesGuard({ isDirty });
  const [orderDate, dueDate, teamName] = useWatch({ control, name: ['orderDate', 'dueDate', 'teamName'] });
  // The shared cards read only the detail fields and the Public website card only its four values: the wider control is narrowed once.
  const detailsControl = control as unknown as OrderDetailsControl;
  const publicForm = { control, setValue } as unknown as PublicWebsiteFormLike;
  const days = daysBetween(orderDate, dueDate);
  // An imported order with no due date says why the box is empty until a date is typed (D-38).
  const noDueDate = opened.dueDate === null && dueDate.trim() === '';
  const dueHint = noDueDate ? COPY.edit.noDueDate : days === null ? undefined : COPY.details.dueHint(days);

  const focusCustomerName = (): void => {
    const element = formRef.current?.elements.namedItem('customerName');
    if (element instanceof HTMLElement) {
      element.focus();
    }
  };

  // The order has arrived: the cursor goes to Customer name (UIC-14).
  useEffect(() => {
    focusCustomerName();
  }, []);

  // Focus goes to the first flagged field once the messages are on screen.
  useEffect(() => {
    if (focusTick > 0 && formRef.current !== null) {
      focusFirstInvalid(formRef.current);
    }
  }, [focusTick]);

  const showFailure = (error: unknown, copy: { title: string; body: string }): void => {
    // A failure that may have saved (a server error, a timeout, no answer) leaves the order, the lists and the money old, so they are read again.
    if (mayHaveSaved(error)) {
      void refetchOrder(opened.id);
      void refreshOrders();
    }
    // 05 D-20: a stale save keeps every typed value; the banner offers Load Latest, which takes focus.
    if (isHttpError(error) && error.status === 409 && error.code === EDIT_STALE) {
      setConflicts((count) => count + 1);
      return;
    }
    if (isHttpError(error) && error.status === 404) {
      setGone(true);
      return;
    }
    // The order was completed or cancelled since the form opened: read it again, and the locked banner takes the form's place.
    if (
      isHttpError(error) &&
      error.status === 422 &&
      (error.code === ORDERS_LOCKED || error.code === ORDERS_PUBLIC_CANCELLED)
    ) {
      void query.refetch().then((result) => {
        if (result.data !== undefined) {
          setOpened(result.data);
        }
      });
      return;
    }
    if (isHttpError(error) && error.status === 400) {
      let matched = false;
      for (const [key, messages] of Object.entries(error.fieldErrors)) {
        const path = DETAIL_FIELDS[key.toLowerCase()];
        const message = messages[0];
        if (path !== undefined && message !== undefined) {
          setError(path, { type: 'server', message });
          matched = true;
        }
      }
      if (matched) {
        setFocusTick((tick) => tick + 1);
        return;
      }
    }
    toast.show({ tone: 'danger', title: copy.title, message: copy.body });
  };

  const submission = useSubmission<UpdateOrderDetailsFormValues, OrderDetailResponse>(
    (_key, values) =>
      ordersService.updateDetails(
        opened.id,
        toUpdateOrderDetailsRequest(values, opened.version, publicWebsiteValuesOf(opened)),
      ),
    {
      onSuccess: (order) => {
        applyOrder(order);
        // The saved form must not hold its own way back to the order.
        guard.allowLeave();
        void navigate(orderPath);
        toast.show({ title: COPY.edit.toast.title, message: order.number });
      },
      onFailure: (copy, error) => {
        showFailure(error, copy);
      },
    },
  );
  const { pending } = submission;

  const onValid = async (values: UpdateOrderDetailsFormValues): Promise<void> => {
    await submission.submit(values);
  };

  const onInvalid = (): void => {
    setFocusTick((tick) => tick + 1);
  };

  /** Load Latest: the typed values are replaced only once the latest order has arrived. */
  const loadLatest = async (): Promise<void> => {
    setLoadingLatest(true);
    const result = await query.refetch();
    setLoadingLatest(false);
    if (result.isError) {
      if (isHttpError(result.error) && result.error.status === 404) {
        setGone(true);
        return;
      }
      const copy = describeHttpError(result.error);
      if (copy !== null) {
        toast.show({ tone: 'danger', title: copy.title, message: copy.body });
      }
      return;
    }
    const latest = result.data;
    if (latest === undefined) return;
    setOpened(latest);
    reset(valuesOf(latest));
    submission.reset();
    setConflicts(0);
    setAnnouncement(COPY.edit.latestLoaded);
    focusCustomerName();
  };

  if (gone) {
    return <OrderNotFound />;
  }

  const caption = saveBarCaption(pending, countErrors(errors), isDirty);

  const head = (
    <div className={pageHeadClasses}>
      <div className={pageHeadTitleClasses}>
        <div className={orderBackRowClasses}>
          <UiLink to={orderPath} className={clsx(loginBackClasses, hitAreaClasses)}>
            <Icon name="chevron-left" size={16} />
            {opened.number}
          </UiLink>
        </div>
        <h1 className={pageTitleClasses}>{COPY.edit.title}</h1>
        <p className={pageSublineClasses}>{COPY.edit.subline}</p>
      </div>
    </div>
  );

  if (isLocked(opened)) {
    return (
      <div className={orderFormPageClasses}>
        {head}
        <OrderLockedBanner status={opened.status === 'cancelled' ? 'cancelled' : 'completed'}>
          <ButtonLink variant="secondary" to={orderPath}>
            {COPY.edit.backToOrder}
          </ButtonLink>
        </OrderLockedBanner>
      </div>
    );
  }

  return (
    <div className={orderFormPageClasses} data-savebar="">
      {head}
      <form
        id={formId}
        ref={formRef}
        noValidate
        className={orderFormLayoutClasses}
        onSubmit={(event: SyntheticEvent<HTMLFormElement>) => {
          void handleSubmit(onValid, onInvalid)(event);
        }}
      >
        <div className={orderFormColClasses}>
          {conflicts > 0 && (
            <ConflictBanner
              key={conflicts}
              pending={loadingLatest}
              onLoadLatest={() => {
                void loadLatest();
              }}
            />
          )}
          <OrderFormCustomerCard control={detailsControl} headingId={`${formId}-customer`} />
          <OrderFormDetailsCard control={detailsControl} headingId={`${formId}-details`} dueHint={dueHint} />
          <PublicWebsiteFormCard form={publicForm} order={opened} teamName={teamName} headingId={`${formId}-public`} />
          <OrderFormSaveBar
            caption={caption}
            saveLabel={COPY.edit.saveBar.save}
            pending={pending}
            onCancel={() => void navigate(orderPath)}
          />
        </div>
        <OrderEditAside order={opened} />
      </form>
      <div role="status" aria-live="polite" className={srOnlyClasses}>
        {announcement}
      </div>
      <ConfirmDialog
        open={guard.dialog.open}
        title={COPY.discard.title}
        message={COPY.discard.message}
        cancelLabel={COPY.discard.keep}
        confirmLabel={COPY.discard.discard}
        onConfirm={guard.dialog.onDiscard}
        onCancel={guard.dialog.onKeepEditing}
        loading={pending}
      />
    </div>
  );
}

/** The order is missing or was deleted (404): a message and the way back to the list. */
function OrderNotFound() {
  return (
    <div className={orderFormPageClasses}>
      <ErrorState title={ORDER_PAGE_COPY.states.notFound} />
      <div className={orderStateActionClasses}>
        <ButtonLink variant="secondary" to={ORDERS_PATH}>
          {ORDER_PAGE_COPY.states.backToOrders}
        </ButtonLink>
      </div>
    </div>
  );
}

/** The Edit Order route: reads the order afresh, then opens the form on it. */
function EditOrderPage({ id }: { id: string }) {
  const query = useOrderQuery(id, { alwaysRefetch: true });
  // The order the form was filled from; set once, so a later refetch never changes the version a save sends.
  const [initial, setInitial] = useState<OrderDetailResponse | null>(null);
  if (initial === null && query.isSuccess && query.isFetchedAfterMount) {
    setInitial(query.data);
  }
  const number = initial?.number;
  useEffect(() => {
    const title = number === undefined ? COPY.edit.title : COPY.edit.documentTitle(number);
    document.title = `${title}${ADMIN_COPY.titleSuffix}`;
  }, [number]);

  const failed = initial === null && query.isError;
  if (failed && isHttpError(query.error) && query.error.status === 404) {
    return <OrderNotFound />;
  }
  return (
    <>
      {failed && (
        <div className={orderFormPageClasses}>
          <ErrorState title={COPY.edit.loadFailed} error={query.error} onRetry={() => void query.refetch()} />
        </div>
      )}
      <LoadingRegion loading={initial === null && !failed} failed={failed} things={COPY.edit.things}>
        {initial !== null && <EditOrderForm initial={initial} />}
        {initial === null && !failed && (
          <div className={orderFormPageClasses}>
            <div className={pageHeadTitleClasses} aria-hidden="true">
              <h1 className={pageTitleClasses}>{COPY.edit.title}</h1>
            </div>
            <SkeletonText lines={3} />
            <SkeletonCard />
          </div>
        )}
      </LoadingRegion>
    </>
  );
}

/** The values a New Order form opened with; set once, so the form is never replaced while it is being filled in. */
interface OpenedForm {
  today: string;
  prefill: OrderPrefill | undefined;
  requestMissing: boolean;
  converted: ExistingOrder | null;
}

/** The order a request became, when this tab already read the request as Converted (Converted is final). */
function knownConversion(queryClient: QueryClient, requestId: string | null): ExistingOrder | null {
  if (requestId === null) return null;
  const detail = queryClient.getQueryData<QuoteRequestDetailResponse>(quoteRequestKey(requestId));
  return detail?.status === 'converted' && detail.orderId !== null
    ? { id: detail.orderId, number: detail.orderNumber }
    : null;
}

/**
 * The New Order route: waits for the server's business date and, with `?fromRequest={id}`, for the request's prefill (UI-SPEC R3),
 * then opens the form on them. A `fromRequest` that is not a request id is dropped with one replace (T-13-64).
 */
function NewOrderPage() {
  const state = useBusinessTodayState();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  // Read once, so a later change of the address never refills the form.
  const [fromRequest] = useState(() => params.get('fromRequest'));
  const requestId = fromRequest !== null && isQuoteRequestId(fromRequest) ? fromRequest : null;
  const dropped = useRef(false);
  useEffect(() => {
    if (requestId === null && params.has('fromRequest') && !dropped.current) {
      dropped.current = true;
      setParams(
        (next) => {
          next.delete('fromRequest');
          return next;
        },
        { replace: true },
      );
    }
  }, [params, requestId, setParams]);
  const prefill = useQuery({
    // Outside `['quote-requests']`, so the form's own invalidations never read it again (W10 IN-01).
    queryKey: ['order-prefill', requestId],
    queryFn: ({ signal }) => quoteRequestsService.getOrderPrefill(requestId ?? '', signal),
    enabled: requestId !== null,
    // Read afresh each time the form opens; the form fills once.
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
  // A read again with no data clears the error, so a failure counts until a read succeeds and the alert stays (W7 WR-01).
  const prefillFailed =
    requestId !== null && prefill.data === undefined && prefill.errorUpdatedAt > prefill.dataUpdatedAt;
  const [heldError, setHeldError] = useState<unknown>(null);
  if (prefill.error !== null && prefill.error !== heldError) {
    setHeldError(prefill.error);
  }
  const prefillError = prefill.error ?? heldError;
  // A request that is gone opens a blank form with a note (UI-SPEC R3).
  const requestMissing = prefillFailed && isHttpError(prefillError) && prefillError.status === 404;
  const prefillReady = requestId === null || prefill.data !== undefined || requestMissing;

  const [opened, setOpened] = useState<OpenedForm | null>(null);
  if (opened === null && state.today !== null && prefillReady) {
    setOpened({
      today: state.today,
      prefill: prefill.data,
      requestMissing,
      converted: prefill.data === undefined ? null : knownConversion(queryClient, requestId),
    });
  }
  useEffect(() => {
    document.title = `${COPY.documentTitle}${ADMIN_COPY.titleSuffix}`;
  }, []);
  if (opened !== null) {
    return (
      <CreateOrderForm
        today={opened.today}
        prefill={opened.prefill}
        requestMissing={opened.requestMissing}
        converted={opened.converted}
      />
    );
  }
  const failed = state.isError || (prefillFailed && !requestMissing);
  return (
    <div className={orderFormPageClasses}>
      {failed && (
        <ErrorState
          title={COPY.loadFailed}
          error={state.isError ? state.error : prefillError}
          onRetry={() => {
            if (state.isError) state.refetch();
            if (prefillFailed && !requestMissing) void prefill.refetch();
          }}
        />
      )}
      <LoadingRegion loading={!failed} failed={failed} things={COPY.things}>
        {!failed && <SkeletonCard />}
      </LoadingRegion>
    </div>
  );
}

/** F1 at orders/new and F2 at orders/:id/edit: the id in the address picks the edit form. */
export default function OrderFormPage() {
  const { id } = useParams();
  return id === undefined ? <NewOrderPage /> : <EditOrderPage id={id} />;
}
