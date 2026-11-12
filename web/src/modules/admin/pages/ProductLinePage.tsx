// SPEC-GAP: product line editor
// S4 Product line editor, /admin/site-content/products/new and /admin/site-content/products/:lineId (CONT-02, PUB-03, OR-3, D-01, D-04, D-07,
// D-34; plan 11-20). One form of cards (Names, Words, What you can customize, Price), saved by one button in the sticky save bar with the line
// version it was opened with.
//   - The form is filled once, from the line read after the page opened (never an older copy). The version a save sends is the one the form
//     was opened with, or that of the last save of this form, never the live query data (SEC-07).
//   - An id that is not a GUID asks the server for nothing and shows "This product line wasn't found." (T-11-50).
//   - A save that goes through shows the toast, puts the saved line in the cache and clears the public data held in this browser
//     (invalidatePublicContent); the page stays on the line. Adding a line then opens its editor so photos can be added.
//   - The "Visitors see" line under the price is a labelled preview of what is typed; the figures are only formatted here.
import { zodResolver } from '@hookform/resolvers/zod';
import clsx from 'clsx';
import { useEffect, useRef, useState, type ReactNode, type SyntheticEvent } from 'react';
import { Controller, FormProvider, useForm, useWatch, type Control, type Path } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { ButtonLink, hitAreaClasses, UiLink } from '@/components/actions';
import { Icon, type IconName } from '@/components/brand';
import { RecordMeta } from '@/components/data';
import { Checkbox, MoneyInput } from '@/components/entry';
import { useToast } from '@/components/feedback';
import { Field } from '@/components/forms';
import {
  loginBackClasses,
  pageHeadClasses,
  pageHeadTitleClasses,
  pageSublineClasses,
  pageTitleClasses,
  srOnlyClasses,
} from '@/components/layout/layout.recipe';
import { ConfirmDialog } from '@/components/overlays';
import { ConflictBanner, ErrorState, LoadingRegion, Note, SkeletonText } from '@/components/states';
import { Badge } from '@/components/status';
import { isHttpError } from '@/core/api/errors';
import { focusFirstInvalid } from '@/lib/forms/focusFirstInvalid';
import { guidParser } from '@/lib/url-state/parsers';
import { expensesFullRowClasses, expensesTitleRowClasses } from '@/modules/admin/components/expenses.recipe';
import { OrderFormSaveBar, saveBarCaption } from '@/modules/admin/components/OrderFormSaveBar';
import { orderFormColClasses, orderFormPageClasses } from '@/modules/admin/components/orderForm.recipe';
import { orderBackRowClasses, orderStateActionClasses } from '@/modules/admin/components/orderPage.recipe';
import { OrderProductTypesCard } from '@/modules/admin/components/OrderProductTypesCard';
import {
  profileCardClasses,
  profileCardBodyClasses,
  profileFormGridClasses,
} from '@/modules/admin/components/profile.recipe';
import { ProductLinePhotosCard } from '@/modules/admin/components/ProductLinePhotosCard';
import { SiteContentCard } from '@/modules/admin/components/SiteContentCard';
import { hoursPreviewClasses, lineCustomizeLabelClasses } from '@/modules/admin/components/siteContent.recipe';
import { ADMIN_COPY } from '@/modules/admin/copy';
import {
  useCreateProductLine,
  useProductLineListQuery,
  useProductLineQuery,
  useUpdateProductLine,
} from '@/modules/admin/hooks/useProductLineQueries';
import { useProductTypesQuery } from '@/modules/admin/hooks/useProductTypesQuery';
import { useUnsavedChangesGuard } from '@/modules/admin/hooks/useUnsavedChangesGuard';
import type { LinePhotoSlot, ProductLineDetail, ProductLinePhoto } from '@/modules/admin/services/productLinesService';
import { describeHttpError } from '@/utils/describeHttpError';
import { SITE_CONTENT_COPY } from '@/modules/admin/siteContentCopy';
import {
  LINE_CUSTOMIZE_FIELDS,
  productLineSchema,
  productLineValuesOf,
  readLineMinimum,
  readLinePrice,
  toProductLineRequest,
  type LineCustomizeField,
  type ProductLineInput,
} from '@/modules/admin/siteContentSchemas';
import { formatPeso } from '@/utils/csps';

const COPY = SITE_CONTENT_COPY.productLine;

/** The Products tab of Site Content: where Back and Cancel go. */
const PRODUCTS_TAB_PATH = '/admin/site-content?tab=products';

/** The editor of one line. */
const editorPath = (id: string): string => `/admin/site-content/products/${encodeURIComponent(id)}`;

/** The icon beside each customize card's title, the same as the public Products page draws. */
const CUSTOMIZE_ICONS: Readonly<Record<LineCustomizeField, IconName>> = {
  fabricText: 'layout-grid',
  collarText: 'shirt',
  cutText: 'ruler',
  namesText: 'zap',
  logosText: 'palette',
};

/** The fields that hold one text. */
type TextName = Exclude<keyof ProductLineInput, 'isActive' | 'productTypeIds'>;

const TEXT_NAMES: readonly TextName[] = [
  'title',
  'shortName',
  'number',
  'cardText',
  'description',
  ...LINE_CUSTOMIZE_FIELDS,
  'startsAtPrice',
  'minimumQuantity',
];

/** The form field a server error key belongs to (the server keys in its own casing), or null when this form draws no such field. */
function formPathOf(key: string): Path<ProductLineInput> | null {
  const lower = key.toLowerCase();
  return TEXT_NAMES.find((name) => name.toLowerCase() === lower) ?? null;
}

interface TextFieldProps {
  control: Control<ProductLineInput>;
  name: TextName;
  label: ReactNode;
  hint?: string;
  placeholder?: string;
  /** A textarea of this many rows. */
  rows?: number;
  required?: boolean;
  className?: string;
  inputMode?: 'numeric';
}

function TextField({
  control,
  name,
  label,
  hint,
  placeholder,
  rows,
  required = false,
  className,
  inputMode,
}: TextFieldProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const shared = {
          label,
          hint,
          placeholder,
          name: field.name,
          value: field.value,
          onChange: field.onChange,
          onBlur: field.onBlur,
          error: fieldState.error?.message ?? '',
          required,
          autoComplete: 'off',
          ...(className === undefined ? {} : { className }),
        };
        if (rows !== undefined) {
          return <Field multiline rows={rows} {...shared} />;
        }
        return <Field {...shared} {...(inputMode === undefined ? {} : { inputMode })} />;
      }}
    />
  );
}

/** What visitors will read under the price: "Starts at ₱650.00 / pc · min. 10 pcs", or "Message us for a price". */
function previewOf(priceText: string, minimumText: string): string {
  const price = readLinePrice(priceText);
  const minimum = readLineMinimum(minimumText);
  const minimumWords = minimum === null ? '' : COPY.preview.minimum(minimum);
  return price === null ? COPY.preview.noPrice(minimumWords) : COPY.preview.startsAt(formatPeso(price), minimumWords);
}

/** The machine code of a save made against an old edit version (SEC-07). */
const EDIT_STALE = 'edit.stale';

/** The latest line from the server, or why it could not be read. */
export type ReloadResult = { readonly line: ProductLineDetail } | { readonly error: unknown };

interface ProductLineFormProps {
  /** The line as it was read when the editor opened, or null for a new one. */
  line: ProductLineDetail | null;
  /** Reads the line from the server again (Load Latest); an edit only. */
  reload?: (() => Promise<ReloadResult>) | undefined;
}

function ProductLineForm({ line, reload }: ProductLineFormProps) {
  const toast = useToast();
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  // The line as last saved: the title and the Hidden badge follow it, and a save sends its version.
  const [saved, setSaved] = useState(line);
  // Counts the times focus should move to the first flagged field once its message is on screen.
  const [focusTick, setFocusTick] = useState(0);
  // The line was deleted while the editor was open (404).
  const [gone, setGone] = useState(false);
  // How many stale saves the server has refused since the form was last current; the banner shows from the first.
  const [conflicts, setConflicts] = useState(0);
  const [loadingLatest, setLoadingLatest] = useState(false);
  const [asking, setAsking] = useState(false);
  // The polite line read out after Load Latest.
  const [status, setStatus] = useState('');
  const form = useForm<ProductLineInput>({
    resolver: zodResolver(productLineSchema),
    mode: 'onBlur',
    defaultValues: productLineValuesOf(line),
  });
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = form;
  const [priceText, minimumText] = useWatch({ control, name: ['startsAtPrice', 'minimumQuantity'] });
  const guard = useUnsavedChangesGuard({ isDirty });
  // The order product types the checklist draws, and the lines they may already be filed under.
  const productTypes = useProductTypesQuery();
  const lineList = useProductLineListQuery();

  const title = saved === null ? COPY.newTitle : saved.title;
  useEffect(() => {
    document.title = `${title}${ADMIN_COPY.titleSuffix}`;
  }, [title]);

  useEffect(() => {
    if (focusTick > 0 && formRef.current !== null) {
      focusFirstInvalid(formRef.current);
    }
  }, [focusTick]);

  const onFailure = (copy: { title: string; body: string }, error: unknown): void => {
    if (isHttpError(error) && error.status === 404 && saved !== null) {
      setGone(true);
      return;
    }
    // 05 D-20: a stale save keeps every typed value; the banner offers Load Latest, which takes focus.
    if (isHttpError(error) && error.status === 409 && error.code === EDIT_STALE) {
      setConflicts((count) => count + 1);
      return;
    }
    if (isHttpError(error) && error.status === 400) {
      let placed = 0;
      let other: string | undefined;
      for (const [key, messages] of Object.entries(error.fieldErrors)) {
        const message = messages[0];
        if (message === undefined) {
          continue;
        }
        const path = formPathOf(key);
        if (path === null) {
          other ??= message;
        } else {
          setError(path, { type: 'server', message });
          placed += 1;
        }
      }
      if (placed > 0) {
        setFocusTick((tick) => tick + 1);
        return;
      }
      toast.show({ tone: 'danger', title: other ?? copy.title, message: other === undefined ? copy.body : '' });
      return;
    }
    toast.show({ tone: 'danger', title: copy.title, message: copy.body });
  };

  const create = useCreateProductLine({
    onSuccess: (made) => {
      // The saved form must not hold its own way to the new line's editor.
      guard.allowLeave();
      void navigate(editorPath(made.id), { replace: true });
      toast.show({
        title: COPY.toast.added.title,
        message: made.isActive ? COPY.toast.added.shownMessage : COPY.toast.added.hiddenMessage,
      });
    },
    onFailure,
  });

  const update = useUpdateProductLine({
    onSuccess: (made) => {
      setSaved(made);
      setConflicts(0);
      reset(productLineValuesOf(made));
      toast.show({ title: COPY.toast.saved.title, message: COPY.toast.saved.message });
    },
    onFailure,
  });

  const pending = create.pending || update.pending;

  /** A photo was saved or taken off: the line shown keeps the photos, and its version stays (a photo does not change the line's version). */
  const onPhotoChange = (slot: LinePhotoSlot, photo: ProductLinePhoto | null): void => {
    setSaved((current) => (current === null ? current : { ...current, photos: { ...current.photos, [slot]: photo } }));
  };

  const onValid = async (values: ProductLineInput): Promise<void> => {
    if (saved === null) {
      await create.submit(toProductLineRequest(values, null));
    } else {
      await update.submit({ id: saved.id, body: toProductLineRequest(values, saved.version) });
    }
  };

  const onInvalid = (): void => {
    setFocusTick((tick) => tick + 1);
  };

  /** Load Latest, once the person has agreed to lose what was typed: the values are replaced only when the latest line has arrived. */
  const loadLatest = async (): Promise<void> => {
    if (reload === undefined) {
      return;
    }
    setLoadingLatest(true);
    const result = await reload();
    setLoadingLatest(false);
    if ('error' in result) {
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
    setSaved(result.line);
    setConflicts(0);
    reset(productLineValuesOf(result.line));
    setStatus(COPY.latestLoaded);
    formRef.current?.querySelector<HTMLElement>('input')?.focus();
  };

  if (gone) {
    return <ProductLineNotFound />;
  }

  const caption = saveBarCaption(pending, Object.keys(errors).length, isDirty);
  const changedBy =
    saved?.updatedByName === null || saved?.updatedByName === undefined
      ? null
      : { name: saved.updatedByName, formerStaff: false };

  return (
    <div className={orderFormPageClasses} data-savebar="">
      <div className={pageHeadClasses}>
        <div className={pageHeadTitleClasses}>
          <div className={orderBackRowClasses}>
            <UiLink to={PRODUCTS_TAB_PATH} className={clsx(loginBackClasses, hitAreaClasses)}>
              <Icon name="chevron-left" size={16} />
              {COPY.back}
            </UiLink>
          </div>
          <div className={expensesTitleRowClasses}>
            <h1 className={pageTitleClasses}>{title}</h1>
            {saved !== null && !saved.isActive && <Badge tone="neutral">{COPY.hidden}</Badge>}
          </div>
          <p className={pageSublineClasses}>{COPY.subline}</p>
        </div>
      </div>
      <FormProvider {...form}>
        <form
          ref={formRef}
          noValidate
          className={orderFormColClasses}
          onSubmit={(event: SyntheticEvent<HTMLFormElement>) => {
            void handleSubmit(onValid, onInvalid)(event);
          }}
        >
          {conflicts > 0 && (
            <ConflictBanner
              key={conflicts}
              pending={loadingLatest}
              onLoadLatest={() => {
                setAsking(true);
              }}
            />
          )}
          <SiteContentCard title={COPY.cards.names.title} hint={COPY.cards.names.hint}>
            <div className={profileFormGridClasses}>
              <Controller
                control={control}
                name="isActive"
                render={({ field }) => (
                  <Checkbox
                    label={COPY.fields.show}
                    checked={field.value}
                    onChange={field.onChange}
                    className={expensesFullRowClasses}
                  />
                )}
              />
              <TextField
                control={control}
                name="title"
                label={COPY.fields.title.label}
                placeholder={COPY.fields.title.placeholder}
                className={expensesFullRowClasses}
                required
              />
              <TextField
                control={control}
                name="shortName"
                label={COPY.fields.shortName.label}
                hint={COPY.fields.shortName.hint}
                placeholder={COPY.fields.shortName.placeholder}
                required
              />
              <TextField
                control={control}
                name="number"
                label={COPY.fields.number.label}
                hint={COPY.fields.number.hint}
                placeholder={COPY.fields.number.placeholder}
              />
            </div>
          </SiteContentCard>
          <SiteContentCard title={COPY.cards.words.title} hint={COPY.cards.words.hint}>
            <div className={profileFormGridClasses}>
              <TextField
                control={control}
                name="cardText"
                label={COPY.fields.cardText.label}
                hint={COPY.fields.cardText.hint}
                className={expensesFullRowClasses}
                rows={2}
                required
              />
              <TextField
                control={control}
                name="description"
                label={COPY.fields.description.label}
                hint={COPY.fields.description.hint}
                className={expensesFullRowClasses}
                rows={3}
                required
              />
            </div>
          </SiteContentCard>
          <SiteContentCard title={COPY.cards.customize.title} hint={COPY.cards.customize.hint}>
            <div className={profileFormGridClasses}>
              {LINE_CUSTOMIZE_FIELDS.map((name) => (
                <TextField
                  key={name}
                  control={control}
                  name={name}
                  label={
                    <span className={lineCustomizeLabelClasses}>
                      <Icon name={CUSTOMIZE_ICONS[name]} size={18} />
                      {COPY.customize[name]}
                    </span>
                  }
                  className={expensesFullRowClasses}
                  rows={2}
                  required
                />
              ))}
            </div>
          </SiteContentCard>
          <SiteContentCard title={COPY.cards.price.title} hint={COPY.cards.price.hint}>
            <div className={profileFormGridClasses}>
              <Controller
                control={control}
                name="startsAtPrice"
                render={({ field, fieldState }) => (
                  <MoneyInput
                    label={COPY.fields.price.label}
                    name={field.name}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message ?? ''}
                  />
                )}
              />
              <TextField
                control={control}
                name="minimumQuantity"
                label={COPY.fields.minimum.label}
                inputMode="numeric"
              />
              <p className={clsx(hoursPreviewClasses, expensesFullRowClasses)}>{previewOf(priceText, minimumText)}</p>
            </div>
          </SiteContentCard>
          {/* SPEC-GAP: product line editor. A new line has no photo slots yet: it says to save first (D-02). */}
          {saved === null ? (
            <SiteContentCard title={COPY.cards.photos.title} hint={COPY.cards.photos.hint}>
              <Note icon="info">{COPY.cards.photos.saveFirst}</Note>
            </SiteContentCard>
          ) : (
            <ProductLinePhotosCard
              lineId={saved.id}
              title={saved.title}
              number={saved.number}
              placeholderArt={saved.placeholderArt}
              photos={saved.photos}
              onPhotoChange={onPhotoChange}
            />
          )}
          <OrderProductTypesCard
            control={control}
            lineId={saved === null ? null : saved.id}
            types={productTypes}
            lines={lineList.data}
          />
          {saved !== null && (
            <RecordMeta
              recordedBy={null}
              recordedAt={null}
              lastChangedBy={changedBy}
              lastChangedAt={saved.updatedAtUtc}
            />
          )}
          <OrderFormSaveBar
            caption={caption}
            saveLabel={saved === null ? COPY.actions.saveNew : COPY.actions.saveEdit}
            pending={pending}
            onCancel={() => void navigate(PRODUCTS_TAB_PATH)}
          />
        </form>
      </FormProvider>
      <div role="status" aria-live="polite" className={srOnlyClasses}>
        {status}
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
      <ConfirmDialog
        open={asking}
        title={COPY.discard.title}
        message={COPY.discard.loadLatestMessage}
        cancelLabel={COPY.discard.keep}
        confirmLabel={COPY.discard.discard}
        onConfirm={() => {
          setAsking(false);
          void loadLatest();
        }}
        onCancel={() => {
          setAsking(false);
        }}
      />
    </div>
  );
}

/** The line is missing, or was deleted (404): a message and the way back to the list (S4 Not found). */
function ProductLineNotFound() {
  return (
    <div className={orderFormPageClasses}>
      <ErrorState title={COPY.notFound.title} message={COPY.notFound.message} />
      <div className={orderStateActionClasses}>
        <ButtonLink variant="secondary" to={PRODUCTS_TAB_PATH}>
          {COPY.notFound.back}
        </ButtonLink>
      </div>
    </div>
  );
}

/** The cards as grey blocks while the line is on its way (S4 Loading). */
function ProductLineSkeleton() {
  return (
    <div className={orderFormPageClasses}>
      <div className={pageHeadTitleClasses} aria-hidden="true">
        <h1 className={pageTitleClasses}>{COPY.newTitle}</h1>
      </div>
      {[0, 1, 2].map((block) => (
        <section key={block} className={profileCardClasses} aria-hidden="true">
          <div className={profileCardBodyClasses}>
            <SkeletonText />
          </div>
        </section>
      ))}
    </div>
  );
}

/** The editor of a line that exists: reads it afresh, then opens the form on it. */
function EditProductLinePage({ idParam }: { idParam: string }) {
  // The id as the server accepts it, or null: nothing is asked for anything else (T-11-50).
  const id = guidParser.parse(idParam);
  const query = useProductLineQuery(id);
  // The line the form was filled from; set once, so a later refetch never changes the version a save sends.
  const [initial, setInitial] = useState<ProductLineDetail | null>(null);
  if (initial === null && query.isSuccess && query.isFetchedAfterMount) {
    setInitial(query.data);
  }
  // The form names the page once it is open; until then (and when there is no line) the page has the plain name.
  useEffect(() => {
    if (initial === null) {
      document.title = `${COPY.documentTitle}${ADMIN_COPY.titleSuffix}`;
    }
  }, [initial]);

  /** Load Latest: the line read again; the form replaces what was typed only when it has arrived. */
  const reload = async (): Promise<ReloadResult> => {
    const result = await query.refetch();
    return result.isError || result.data === undefined ? { error: result.error } : { line: result.data };
  };

  const notFound = id === null || (isHttpError(query.error) && query.error.status === 404);
  if (initial === null && notFound) {
    return <ProductLineNotFound />;
  }
  const failed = initial === null && query.isError;
  return (
    <>
      {failed && (
        <div className={orderFormPageClasses}>
          <ErrorState
            things={COPY.things}
            error={query.error}
            onRetry={() => {
              void query.refetch();
            }}
          />
        </div>
      )}
      <LoadingRegion loading={initial === null && !failed} failed={failed} things={COPY.things}>
        {initial !== null && <ProductLineForm line={initial} reload={reload} />}
        {initial === null && !failed && <ProductLineSkeleton />}
      </LoadingRegion>
    </>
  );
}

/** The editor of a new line. */
function NewProductLinePage() {
  return <ProductLineForm line={null} />;
}

/** The segment of `/admin/site-content/products/new`. It is no GUID, so it can never be the id of a line. */
const NEW_SEGMENT = 'new';

export interface ProductLineRouteProps {
  /** The last segment of the address: `new` or the id of a line. Without it the route's own `lineId` parameter is read (no segment: a new line). */
  lineId?: string | undefined;
}

/** The product line editor: `products/new` opens the form for a new line, `products/{id}` the form for a line that exists. */
export function ProductLineRoute({ lineId: given }: ProductLineRouteProps = {}) {
  const params = useParams();
  const lineId = given ?? params.lineId;
  return lineId === undefined || lineId === NEW_SEGMENT ? (
    <NewProductLinePage />
  ) : (
    <EditProductLinePage key={lineId} idParam={lineId} />
  );
}
