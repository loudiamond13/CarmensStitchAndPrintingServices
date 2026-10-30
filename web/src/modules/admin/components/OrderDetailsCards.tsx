// The two cards the New Order and Edit Order forms share (UI-SPEC F1 and F2; plans 08-13, 08-15): Customer details, and Order
// details (dates, an optional Status field the create form passes in, and Notes). Each form owns its own useForm; the cards read the
// shared detail fields through `control`.
import type { ReactNode } from 'react';
import { Controller, type Control } from 'react-hook-form';
import { DateInput, Field } from '@/components/forms';
import {
  orderFormCardClasses,
  orderFormCardHeadClasses,
  orderFormCardHintClasses,
  orderFormCardTitleClasses,
  orderFormFullClasses,
  orderFormGridClasses,
  orderFormSpacerClasses,
} from '@/modules/admin/components/orderForm.recipe';
import { ORDER_FORM_COPY } from '@/modules/admin/orderFormCopy';
import type { OrderDetailsFormInput, OrderDetailsFormValues } from '@/modules/admin/orderFormSchemas';

const COPY = ORDER_FORM_COPY;

/** The control of a form whose fields include the order details. */
export type OrderDetailsControl = Control<OrderDetailsFormInput, unknown, OrderDetailsFormValues>;

export interface OrderCustomerCardProps {
  control: OrderDetailsControl;
  /** Id of the card's heading, so the section can name itself. */
  headingId: string;
}

/** Card 1: who the order is for. */
export function OrderFormCustomerCard({ control, headingId }: OrderCustomerCardProps) {
  return (
    <section className={orderFormCardClasses} aria-labelledby={headingId}>
      <div className={orderFormCardHeadClasses}>
        <div>
          <h2 id={headingId} className={orderFormCardTitleClasses}>
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
  );
}

export interface OrderDetailsCardProps {
  control: OrderDetailsControl;
  headingId: string;
  /** The line under Due date: how far off it is, or why it is empty. */
  dueHint: string | undefined;
  /** The Status field of the create form; the edit form has none (the status changes on the order page). */
  statusField?: ReactNode;
}

/** Card 2: dates and notes, with the create form's Status field between them. */
export function OrderFormDetailsCard({ control, headingId, dueHint, statusField }: OrderDetailsCardProps) {
  return (
    <section className={orderFormCardClasses} aria-labelledby={headingId}>
      <div className={orderFormCardHeadClasses}>
        <div>
          <h2 id={headingId} className={orderFormCardTitleClasses}>
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
              hint={dueHint}
              required
            />
          )}
        />
        {statusField !== undefined && (
          <>
            {statusField}
            <span className={orderFormSpacerClasses} aria-hidden="true" />
          </>
        )}
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
  );
}
