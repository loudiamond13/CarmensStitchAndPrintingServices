// The sticky save bar of the order forms (UI-SPEC F1 "Save bar", F2; plans 08-13, 08-15): a caption, Cancel and the primary save
// button. Cancel stays plain because a dirty form asks "Discard changes?" before it leaves (D-57).
import { Button } from '@/components/actions';
import {
  orderSaveBarButtonClasses,
  orderSaveBarCaptionClasses,
  orderSaveBarClasses,
} from '@/modules/admin/components/orderForm.recipe';
import { ORDER_FORM_COPY } from '@/modules/admin/orderFormCopy';

const COPY = ORDER_FORM_COPY.saveBar;

export interface OrderFormSaveBarProps {
  caption: string;
  saveLabel: string;
  pending: boolean;
  onCancel: () => void;
}

/** The caption: Saving, the count of flagged fields, Unsaved changes, or nothing on a form nobody touched. */
export function saveBarCaption(pending: boolean, flagged: number, isDirty: boolean): string {
  if (pending) return COPY.saving;
  if (flagged > 0) return COPY.attention(flagged);
  return isDirty ? COPY.unsaved : '';
}

export function OrderFormSaveBar({ caption, saveLabel, pending, onCancel }: OrderFormSaveBarProps) {
  return (
    <div className={orderSaveBarClasses}>
      <p className={orderSaveBarCaptionClasses}>{caption}</p>
      <Button variant="secondary" className={orderSaveBarButtonClasses} onClick={onCancel}>
        {COPY.cancel}
      </Button>
      <Button variant="primary" type="submit" icon="check" className={orderSaveBarButtonClasses} pending={pending}>
        {pending ? COPY.saving : saveLabel}
      </Button>
    </div>
  );
}
