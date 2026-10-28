// SPEC-GAP: DateInput (UI-SPEC "SPEC-GAP Primitive Specs" → DateInput; first needed by the Audit Log range filter).
// A Field with a native date input: the field-control look (44px, 16px text), `min` and `max`, and a YYYY-MM-DD value in
// business time. The browser's picker and keyboard are the native ones. The range and format rules are the caller's zod
// schema (OR-3); its message goes in `error` and shows under the field.
import { Field, type FieldProps } from './Field';

type InputFieldProps = Exclude<FieldProps, { multiline: true }>;

export type DateInputProps = Omit<
  InputFieldProps,
  'type' | 'value' | 'defaultValue' | 'onChange' | 'min' | 'max' | 'multiline'
> & {
  /** YYYY-MM-DD, or '' for no date. */
  value: string;
  onChange: (value: string) => void;
  /** Earliest date, YYYY-MM-DD. */
  min?: string;
  /** Latest date, YYYY-MM-DD. */
  max?: string;
};

export function DateInput({ value, onChange, min, max, ...rest }: DateInputProps) {
  return (
    <Field
      {...rest}
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
