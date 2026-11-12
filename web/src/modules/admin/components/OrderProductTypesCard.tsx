// SPEC-GAP: product line editor, order product types
// S4 card 6 "Order product types" (CONT-02, D-09; plan 11-20): a checklist of every active order product type, A to Z, that decides which
// orders are filed under this line when staff show them on the website.
//   - A type that belongs to another line says so in muted words, " (now under Volleyball Jerseys)"; ticking it moves it here on save.
//   - The ids of types the checklist does not draw (a retired type filed here) stay in the form's list, so a save never frees them.
//   - With no product types the card says so and links to Settings, where they are added.
//   - The product types and the line list come from the editor, which reads them (useProductTypesQuery); the card has its own loading and error states.
import type { UseQueryResult } from '@tanstack/react-query';
import clsx from 'clsx';
import { Controller, type Control } from 'react-hook-form';
import { hitAreaClasses, UiLink } from '@/components/actions';
import { Checkbox } from '@/components/entry';
import { ErrorState, LoadingRegion, SkeletonText } from '@/components/states';
import { SiteContentCard } from '@/modules/admin/components/SiteContentCard';
import {
  lineInlineLinkClasses,
  lineTypeNoteClasses,
  lineTypesFieldsetClasses,
  lineTypesHintClasses,
  lineTypesLegendClasses,
} from '@/modules/admin/components/siteContent.recipe';
import type { ProductLineListItem } from '@/modules/admin/services/productLinesService';
import type { ProductTypeListItem } from '@/modules/admin/services/productTypesService';
import { SITE_CONTENT_COPY } from '@/modules/admin/siteContentCopy';
import type { ProductLineInput } from '@/modules/admin/siteContentSchemas';

const COPY = SITE_CONTENT_COPY.productLine;

const SETTINGS_PATH = '/admin/settings';

export interface OrderProductTypesCardProps {
  control: Control<ProductLineInput>;
  /** The line being edited, or null for a new one: a type filed under any other line is named. */
  lineId: string | null;
  /** The order product types (useProductTypesQuery). */
  types: Pick<UseQueryResult<ProductTypeListItem[]>, 'data' | 'isPending' | 'isError' | 'error' | 'refetch'>;
  /** Every product line, so a type filed under another line can be named; undefined until the list has arrived. */
  lines: readonly ProductLineListItem[] | undefined;
}

export function OrderProductTypesCard({ control, lineId, types, lines }: OrderProductTypesCardProps) {
  /** The title of the line another line holds this type under, or null when it is free or filed here. */
  const otherLineOf = (typeId: string): string | null =>
    lines?.find((line) => line.id !== lineId && line.productTypeIds.includes(typeId))?.title ?? null;

  const active = (types.data ?? [])
    .filter((type) => type.status === 'active')
    .toSorted((a, b) => a.name.localeCompare(b.name));

  let body;
  if (types.isError) {
    body = (
      <ErrorState
        things={COPY.types.things}
        error={types.error}
        onRetry={() => {
          void types.refetch();
        }}
      />
    );
  } else if (types.isPending) {
    body = <SkeletonText />;
  } else if (active.length === 0) {
    body = (
      <p className={lineTypesHintClasses}>
        {COPY.types.none.before}
        <UiLink to={SETTINGS_PATH} className={clsx(lineInlineLinkClasses, hitAreaClasses)}>
          {COPY.types.none.link}
        </UiLink>
        {COPY.types.none.after}
      </p>
    );
  } else {
    body = (
      <Controller
        control={control}
        name="productTypeIds"
        render={({ field }) => (
          <fieldset className={lineTypesFieldsetClasses}>
            <legend className={lineTypesLegendClasses}>{COPY.types.legend}</legend>
            {active.map((type) => {
              const elsewhere = otherLineOf(type.id);
              return (
                <Checkbox
                  key={type.id}
                  label={
                    <>
                      {type.name}
                      {elsewhere !== null && (
                        <span className={lineTypeNoteClasses}>{COPY.types.nowUnder(elsewhere)}</span>
                      )}
                    </>
                  }
                  checked={field.value.includes(type.id)}
                  onChange={(checked) => {
                    field.onChange(checked ? [...field.value, type.id] : field.value.filter((id) => id !== type.id));
                  }}
                />
              );
            })}
            <p className={lineTypesHintClasses}>{COPY.types.hint}</p>
          </fieldset>
        )}
      />
    );
  }

  return (
    <SiteContentCard title={COPY.cards.types.title} hint={COPY.cards.types.hint}>
      <LoadingRegion loading={types.isPending} failed={types.isError} things={COPY.types.things}>
        {body}
      </LoadingRegion>
    </SiteContentCard>
  );
}
