// The four fields of an order's public website settings (UI-SPEC O1; D-09, D-11, D-13, D-16; plan 11-27): "Customer said OK to show",
// "Show on the website", "Show under" and "Name shown", and a labelled "Visitors see" preview. The Public Website window and, in plan
// 11-35, the card of the order forms draw them. Show waits for the OK: it is aria-disabled (focusable, so its hint is read) until the OK
// is ticked, and unticking the OK unticks it (D-11). The line preset and the pieces are the server's answer; the browser works out neither.
import { type UseFormReturn, Controller, useWatch } from 'react-hook-form';
import { Checkbox } from '@/components/entry';
import { Field, Select, type SelectOption } from '@/components/forms';
import { orderPublicCheckClasses, orderPublicPreviewClasses } from '@/modules/admin/components/orderPage.recipe';
import { orderWindowBodyClasses } from '@/modules/admin/components/orderWindow.recipe';
import { PUBLIC_WEBSITE_COPY } from '@/modules/admin/publicWebsiteCopy';
import type { PublicWebsiteFormInput, PublicWebsiteFormValues } from '@/modules/admin/publicWebsiteSchemas';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import type { ProductLineOption } from '@/modules/admin/services/publicWebsiteService';
import { formatCount } from '@/utils/format';

const COPY = PUBLIC_WEBSITE_COPY.fields;

/** What the fields read from the order. Null on a new order, which has no team or line yet. */
export type PublicWebsiteFieldsOrder = Pick<OrderDetailResponse, 'teamName' | 'publicWebsite'>;

/** What the fields use of a form: the window's own form, or the order forms' form narrowed to these four values. */
export type PublicWebsiteFormLike = Pick<
  UseFormReturn<PublicWebsiteFormInput, unknown, PublicWebsiteFormValues>,
  'control' | 'setValue'
>;

export interface PublicWebsiteFieldsProps {
  form: PublicWebsiteFormLike;
  order: PublicWebsiteFieldsOrder | null;
  /** The team as typed on an order form; the window reads the order's own team. */
  teamName?: string | null | undefined;
  /** The active lines the order can be shown under. */
  lineOptions: readonly ProductLineOption[];
  /** The labelled "Visitors see" preview: on the window, not on the new order form (items are still being added). */
  showPreview: boolean;
  /** Show under is required once Show is ticked. False on a new order, where the server works the line out from the items. */
  lineRequired?: boolean;
}

/** The options of Show under: the active lines, and the order's current line when it was hidden after the order chose it. */
function lineChoices(
  lineOptions: readonly ProductLineOption[],
  order: PublicWebsiteFieldsOrder | null,
): SelectOption[] {
  const choices: SelectOption[] = lineOptions.map((line) => ({ value: line.id, label: line.title }));
  const currentId = order?.publicWebsite.productLineId ?? null;
  const currentTitle = order?.publicWebsite.productLineTitle ?? null;
  if (currentId !== null && currentTitle !== null && !lineOptions.some((line) => line.id === currentId)) {
    choices.push({ value: currentId, label: currentTitle });
  }
  return choices;
}

/**
 * The words after "Visitors see:": the name in capitals (the typed name, else the team), the line's short name and the pieces. The pieces
 * and the line are the server's; a part with nothing to show is left out.
 */
function previewParts(
  order: PublicWebsiteFieldsOrder,
  lineOptions: readonly ProductLineOption[],
  typed: { publicName?: string | undefined; productLineId?: string | undefined },
): string[] {
  const block = order.publicWebsite;
  const name = (typed.publicName ?? '').trim() || (order.teamName ?? '').trim();
  const lineId = typed.productLineId ?? '';
  const line =
    lineOptions.find((option) => option.id === lineId)?.shortName ??
    (lineId !== '' && lineId === block.productLineId ? block.productLineTitle : null);
  return [
    ...(name === '' ? [] : [name.toUpperCase()]),
    ...(line === null ? [] : [line]),
    COPY.pieces(formatCount(Number(block.pieces))),
  ];
}

export function PublicWebsiteFields({
  form,
  order,
  teamName,
  lineOptions,
  showPreview,
  lineRequired = true,
}: PublicWebsiteFieldsProps) {
  const { control, setValue } = form;
  // Only these four values are watched: an order form holds many more, and none of them redraws the card.
  const [consentValue, showValue, lineValue, nameValue] = useWatch({
    control,
    name: ['customerConsent', 'showOnWebsite', 'productLineId', 'publicName'],
  });
  const typed = { publicName: nameValue, productLineId: lineValue };
  const consent = consentValue;
  const team = (teamName === undefined ? order?.teamName : teamName)?.trim() ?? '';
  const hasTeam = team !== '';
  return (
    <div className={orderWindowBodyClasses}>
      <Controller
        control={control}
        name="customerConsent"
        render={({ field }) => (
          <div className={orderPublicCheckClasses}>
            <Checkbox
              name={field.name}
              label={COPY.consent}
              hint={COPY.consentHint}
              checked={field.value}
              onChange={(checked) => {
                field.onChange(checked);
                if (!checked) {
                  setValue('showOnWebsite', false, { shouldDirty: true });
                }
              }}
            />
          </div>
        )}
      />
      <Controller
        control={control}
        name="showOnWebsite"
        render={({ field, fieldState }) => (
          <div className={orderPublicCheckClasses}>
            <Checkbox
              name={field.name}
              label={COPY.show}
              hint={consent ? undefined : COPY.showBlockedHint}
              error={fieldState.error?.message ?? ''}
              ariaDisabled={!consent}
              checked={field.value}
              onChange={field.onChange}
            />
          </div>
        )}
      />
      <Controller
        control={control}
        name="productLineId"
        render={({ field, fieldState }) => (
          <Select
            label={COPY.line}
            hint={COPY.lineHint}
            placeholder={COPY.linePlaceholder}
            options={lineChoices(lineOptions, order)}
            name={field.name}
            value={field.value}
            onChange={(event) => {
              field.onChange(event.target.value);
            }}
            onBlur={field.onBlur}
            error={fieldState.error?.message ?? ''}
            required={lineRequired && showValue}
          />
        )}
      />
      <Controller
        control={control}
        name="publicName"
        render={({ field, fieldState }) => (
          <Field
            label={COPY.name}
            hint={hasTeam ? COPY.nameHint(team) : COPY.noTeamHint}
            placeholder={team}
            name={field.name}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message ?? ''}
            autoComplete="off"
            required={!hasTeam && showValue}
          />
        )}
      />
      {showPreview && order !== null && (
        <p className={orderPublicPreviewClasses}>{COPY.preview(previewParts(order, lineOptions, typed))}</p>
      )}
    </div>
  );
}
