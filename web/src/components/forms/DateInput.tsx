// SPEC-GAP: DateInput (UI-SPEC "SPEC-GAP Primitive Specs" → DateInput; first needed by the Audit Log range filter).
// A Field with a native date input: the field-control look (44px, 16px text), `min` and `max`, and a YYYY-MM-DD value in
// business time. The browser's picker and keyboard are the native ones. The range and format rules are the caller's zod
// schema (OR-3); its message goes in `error` and shows under the field. `readableDate` writes the date out beside the box.
import { formatCalendarDate } from '@/utils/format';
import { Field, type FieldProps } from './Field';
import { dateReadableClasses } from './field.recipe';

type InputFieldProps = Exclude<FieldProps, { multiline: true }>;

export type DateInputProps = Omit<
  InputFieldProps,
  'type' | 'value' | 'defaultValue' | 'onChange' | 'min' | 'max' | 'multiline' | 'beside'
> & {
  /** YYYY-MM-DD, or '' for no date. */
  value: string;
  onChange: (value: string) => void;
  /** Earliest date, YYYY-MM-DD. */
  min?: string;
  /** Latest date, YYYY-MM-DD. */
  max?: string;
  /** Writes the chosen date out beside the box ("Sep 26, 2026"), hidden from assistive technology. */
  readableDate?: boolean;
};

export function DateInput({ value, onChange, min, max, readableDate = false, ...rest }: DateInputProps) {
  return (
    <Field
      {...rest}
      beside={
        readableDate ? (
          <span aria-hidden="true" className={dateReadableClasses}>
            {formatCalendarDate(value)}
          </span>
        ) : undefined
      }
      type="date"
      value={value}
      min={min}
      max={max}
      onChange={(event) => {
        onChange(event.currentTarget.value);
      }}
    />
  );
}
