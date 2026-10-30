// F1 New Order, /admin/orders/new (ORD-03, ORD-15, D-27, D-30, D-49, D-59; plan 08-13). Customer and order details, the Images card
// (coming soon), the items and one save that sends them together. Every server rule is checked in the browser first with the
// server's own words (OR-3). One Idempotency-Key covers a submission and its retries (SEC-06). The order date starts at the
// server's business today; the device clock is never read (D-59).
import { zodResolver } from '@hookform/resolvers/zod';
import clsx from 'clsx';
import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react';
import { Controller, useForm, useWatch, type FieldPath } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router';
import { Button, UiLink, hitAreaClasses } from '@/components/actions';
import { Icon } from '@/components/brand';
import { DateInput, Field, Select } from '@/components/forms';
import { useToast } from '@/components/feedback';
import {
  loginBackClasses,
  pageHeadClasses,
  pageHeadTitleClasses,
  pageSublineClasses,
  pageTitleClasses,
} from '@/components/layout/layout.recipe';
import { ConfirmDialog } from '@/components/overlays';
import { ErrorState, LoadingRegion, SkeletonCard } from '@/components/states';
import { isHttpError } from '@/core/api/errors';
import { focusFirstInvalid } from '@/lib/forms/focusFirstInvalid';
import { useSubmission } from '@/lib/forms/useSubmission';
import { OrderItemsEditor } from '@/modules/admin/components/OrderItemsEditor';
import { OrderSummaryAside } from '@/modules/admin/components/OrderSummaryAside';
import {
  orderFormBannerClasses,
  orderFormCardClasses,
  orderFormCardHeadClasses,
  orderFormCardHintClasses,
  orderFormCardTitleClasses,
  orderFormColClasses,
  orderFormFullClasses,
  orderFormGridClasses,
  orderFormLayoutClasses,
  orderFormPageClasses,
  orderFormSpacerClasses,
  orderSaveBarButtonClasses,
  orderSaveBarCaptionClasses,
  orderSaveBarClasses,
} from '@/modules/admin/components/orderForm.recipe';
import { orderBackRowClasses } from '@/modules/admin/components/orderPage.recipe';
import {
  orderImagesBodyClasses,
  orderImageTileClasses,
} from '@/modules/admin/components/orderPage.recipe';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { useApplyOrder } from '@/modules/admin/hooks/useApplyOrder';
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
  type CreateOrderFormValues,
} from '@/modules/admin/orderFormSchemas';
import { backTarget } from '@/modules/admin/orderNavigation';
import { ORDER_PAGE_COPY } from '@/modules/admin/orderPageCopy';
import { ordersService, type OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { ORDER_STATUSES, type OrderStatus } from '@/utils/csps';
import { isCalendarDate } from '@/lib/url-state/parsers';

const COPY = ORDER_FORM_COPY;
const IMAGES = ORDER_PAGE_COPY.images;

/** The server's code for "saving is busy, nothing was saved". */
const ORDERS_BUSY = 'orders.busy';

const STATUS_OPTIONS = CREATE_STATUSES.map((status) => ({ value: status, label: ORDER_STATUSES[status as OrderStatus] }));

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

const TOP_FIELDS: Readonly<Record<string, FieldPath<CreateOrderFormInput>>> = {
  customername: 'customerName',
  teamname: 'teamName',
  contactnumber: 'contactNumber',
  email: 'email',
  address: 'address',
  orderdate: 'orderDate',
  duedate: 'dueDate',
  status: 'status',
  notes: 'notes',
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
  return field !== undefined && row < rows ? (`items.${String(row)}.${field}` as FieldPath<CreateOrderFormInput>) : null;
}

interface Banner {
  title: string;
  message: string;
}

interface CreateOrderFormProps {
  /** The server's business today: the order date starts here (D-59). */
  today: string;
}

function CreateOrderForm({ today }: CreateOrderFormProps) {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const applyOrder = useApplyOrder();
  const backTo = backTarget(location.state);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [focusTick, setFocusTick] = useState(0);

  const {
    control,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isDirty },
  } = useForm<CreateOrderFormInput, unknown, CreateOrderFormValues>({
    resolver: zodResolver(createOrderSchema),
    mode: 'onBlur',
    defaultValues: {
      customerName: '',
      teamName: '',
      contactNumber: '',
      email: '',
      address: '',
      orderDate: today,
      dueDate: '',
      status: 'pending',
      notes: '',
      items: [blankOrderItem()],
    },
  });

  const guard = useUnsavedChangesGuard({ isDirty });
  const [orderDate, dueDate, status] = useWatch({ control, name: ['orderDate', 'dueDate', 'status'] });
  const preview = useItemsPreview(control);
  const days = daysBetween(orderDate, dueDate);

  // Focus goes to the first flagged field once the messages are on screen.
  useEffect(() => {
    if (focusTick > 0 && formRef.current !== null) {
      focusFirstInvalid(formRef.current);
    }
  }, [focusTick]);

  const showFailure = (error: unknown, copy: { title: string; body: string }): void => {
    if (isHttpError(error) && error.status === 409 && error.code === ORDERS_BUSY) {
      setBanner({ title: COPY.busy.title, message: COPY.busy.message });
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

  const submission = useSubmission<CreateOrderFormValues, OrderDetailResponse>(
    (key, values) => ordersService.create(toCreateOrderRequest(values), key),
    {
      onSuccess: (order) => {
        applyOrder(order);
        // The saved form must not hold its own way to the new order.
        guard.allowLeave();
        void navigate(`/admin/orders/${order.id}`);
        const who = order.teamName !== null && order.teamName !== '' ? order.teamName : order.customerName;
        toast.show({ title: COPY.toast.title, message: COPY.toast.message(order.number, who) });
      },
      onFailure: (copy, error) => {
        showFailure(error, copy);
      },
    },
  );
  const { pending } = submission;

  const onValid = async (values: CreateOrderFormValues): Promise<void> => {
    setBanner(null);
    await submission.submit(values);
  };

  const onInvalid = (): void => {
    setFocusTick((tick) => tick + 1);
  };

  const itemsError = errors.items?.root?.message ?? errors.items?.message;
  const flagged = countErrors(errors);
  let caption = '';
  if (pending) {
    caption = COPY.saveBar.saving;
  } else if (flagged > 0) {
    caption = COPY.saveBar.attention(flagged);
  } else if (isDirty) {
    caption = COPY.saveBar.unsaved;
  }

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
          {banner !== null && (
            <div className={orderFormBannerClasses}>
              <ErrorState title={banner.title} message={banner.message} align="start" />
            </div>
          )}
          <section className={orderFormCardClasses} aria-labelledby={`${formId}-customer`}>
            <div className={orderFormCardHeadClasses}>
              <div>
                <h2 id={`${formId}-customer`} className={orderFormCardTitleClasses}>
                  {COPY.customer.title}
                </h2>
                <p className={orderFormCardHintClasses}>{COPY.customer.hint}</p>
              </div>
            </div>
            <div className={orderFormGridClasses}>
              <Controller
                control={control}
                name="customerName"
                render={({ field, fieldState }) => (
                  <Field
                    label={COPY.customer.customerName}
                    name={field.name}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message ?? ''}
                    autoComplete="off"
                    required
                  />
                )}
              />
              <Controller
                control={control}
                name="teamName"
                render={({ field, fieldState }) => (
                  <Field
                    label={COPY.customer.teamName}
                    hint={COPY.customer.teamNameHint}
                    name={field.name}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message ?? ''}
                    autoComplete="off"
                  />
                )}
              />
              <Controller
                control={control}
                name="contactNumber"
                render={({ field, fieldState }) => (
                  <Field
                    label={COPY.customer.contactNumber}
                    type="tel"
                    inputMode="tel"
                    name={field.name}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message ?? ''}
                    autoComplete="off"
                    required
                  />
                )}
              />
              <Controller
                control={control}
                name="email"
                render={({ field, fieldState }) => (
                  <Field
                    label={COPY.customer.email}
                    type="email"
                    name={field.name}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message ?? ''}
                    autoComplete="off"
                  />
                )}
              />
              <div className={orderFormFullClasses}>
                <Controller
                  control={control}
                  name="address"
                  render={({ field, fieldState }) => (
                    <Field
                      label={COPY.customer.address}
                      placeholder={COPY.customer.addressPlaceholder}
                      name={field.name}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      error={fieldState.error?.message ?? ''}
                      autoComplete="off"
                    />
                  )}
                />
              </div>
            </div>
          </section>
          <section className={orderFormCardClasses} aria-labelledby={`${formId}-details`}>
            <div className={orderFormCardHeadClasses}>
              <div>
                <h2 id={`${formId}-details`} className={orderFormCardTitleClasses}>
                  {COPY.details.title}
                </h2>
                <p className={orderFormCardHintClasses}>{COPY.details.hint}</p>
              </div>
            </div>
            <div className={orderFormGridClasses}>
              <Controller
                control={control}
                name="orderDate"
                render={({ field, fieldState }) => (
                  <DateInput
                    label={COPY.details.orderDate}
                    name={field.name}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message ?? ''}
                    required
                  />
                )}
              />
              <Controller
                control={control}
                name="dueDate"
                render={({ field, fieldState }) => (
                  <DateInput
                    label={COPY.details.dueDate}
                    name={field.name}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message ?? ''}
                    hint={days === null ? undefined : COPY.details.dueHint(days)}
                    required
                  />
                )}
              />
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
              <span className={orderFormSpacerClasses} aria-hidden="true" />
              <div className={orderFormFullClasses}>
                <Controller
                  control={control}
                  name="notes"
                  render={({ field, fieldState }) => (
                    <Field
                      multiline
                      rows={4}
                      label={COPY.details.notes}
                      name={field.name}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      error={fieldState.error?.message ?? ''}
                    />
                  )}
                />
              </div>
            </div>
          </section>
          <section className={orderFormCardClasses} aria-labelledby={`${formId}-images`}>
            <div className={orderFormCardHeadClasses}>
              <div>
                <h2 id={`${formId}-images`} className={orderFormCardTitleClasses}>
                  {IMAGES.title}
                </h2>
                <p className={orderFormCardHintClasses}>{IMAGES.hint}</p>
              </div>
            </div>
            <div className={orderImagesBodyClasses}>
              <span className={orderImageTileClasses}>
                <Icon name="image" size={28} />
              </span>
              <p>{IMAGES.soon}</p>
            </div>
          </section>
          <OrderItemsEditor control={control} rootError={itemsError} />
          <div className={orderSaveBarClasses}>
            <p className={orderSaveBarCaptionClasses}>{caption}</p>
            <Button variant="secondary" className={orderSaveBarButtonClasses} onClick={() => void navigate(backTo)}>
              {COPY.saveBar.cancel}
            </Button>
            <Button
              variant="primary"
              type="submit"
              icon="check"
              className={orderSaveBarButtonClasses}
              pending={pending}
            >
              {pending ? COPY.saveBar.saving : COPY.saveBar.save}
            </Button>
          </div>
        </div>
        <OrderSummaryAside
          status={status}
          dueDate={dueDate}
          lineItems={preview.lines}
          pieces={preview.pieces}
          total={preview.subtotal}
        />
      </form>
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

/** The New Order route: waits for the server's business date, then opens the form on it. */
export default function OrderFormPage() {
  const state = useBusinessTodayState();
  useEffect(() => {
    document.title = `${COPY.documentTitle}${ADMIN_COPY.titleSuffix}`;
  }, []);
  if (state.today !== null) {
    return <CreateOrderForm today={state.today} />;
  }
  return (
    <div className={orderFormPageClasses}>
      {state.isError && (
        <ErrorState
          title={COPY.loadFailed}
          error={state.error}
          onRetry={() => {
            state.refetch();
          }}
        />
      )}
      <LoadingRegion loading={!state.isError} failed={state.isError} things={COPY.things}>
        {!state.isError && <SkeletonCard />}
      </LoadingRegion>
    </div>
  );
}
