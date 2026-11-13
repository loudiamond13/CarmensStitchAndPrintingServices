// SPEC-GAP: public website form card
// The Public website card of the New Order and Edit Order forms (UI-SPEC O1, F1 and F2; D-11, D-13, D-16; plan 11-35): the same four
// fields as the order window, in a form card with a hint. There is no "Visitors see" preview: on a new order the items are still being
// added. The values live in the order form and save with the order; the card only draws them.
import {
  PublicWebsiteFields,
  type PublicWebsiteFieldsOrder,
  type PublicWebsiteFormLike,
} from '@/modules/admin/components/PublicWebsiteFields';
import {
  orderFormCardClasses,
  orderFormCardHeadClasses,
  orderFormCardHintClasses,
  orderFormCardTitleClasses,
  orderFormPublicBodyClasses,
} from '@/modules/admin/components/orderForm.recipe';
import { useProductLineOptionsQuery } from '@/modules/admin/hooks/usePublicWebsite';
import { PUBLIC_WEBSITE_COPY } from '@/modules/admin/publicWebsiteCopy';

const COPY = PUBLIC_WEBSITE_COPY.formCard;

export interface PublicWebsiteFormCardProps {
  /** The order form's control and setValue, narrowed to the four public website values. */
  form: PublicWebsiteFormLike;
  /** The order being edited (its line and pieces); null on a new order. */
  order: PublicWebsiteFieldsOrder | null;
  /** The team as typed on the form: an order with no team needs a name to be shown. */
  teamName: string;
  headingId: string;
  /** True on a new order: the line is worked out from the items on save, so Show under is not required. */
  lineFromItems?: boolean;
}

export function PublicWebsiteFormCard({
  form,
  order,
  teamName,
  headingId,
  lineFromItems = false,
}: PublicWebsiteFormCardProps) {
  const options = useProductLineOptionsQuery(true);
  return (
    <section className={orderFormCardClasses} aria-labelledby={headingId}>
      <div className={orderFormCardHeadClasses}>
        <div>
          <h2 id={headingId} className={orderFormCardTitleClasses}>
            {COPY.title}
          </h2>
          <p className={orderFormCardHintClasses}>{COPY.hint}</p>
        </div>
      </div>
      <div className={orderFormPublicBodyClasses}>
        <PublicWebsiteFields
          form={form}
          order={order}
          teamName={teamName}
          lineOptions={options.data ?? []}
          showPreview={false}
          lineRequired={!lineFromItems}
        />
      </div>
    </section>
  );
}
