// RED stub (plan 02-19 Task 2): replaced in GREEN.
import type { IconName } from '@/ui/brand';

export interface SegmentOption<V extends string = string> {
  value: V;
  label: string;
  icon?: IconName | undefined;
  showLabel?: boolean | undefined;
}

export interface SegmentedControlProps<V extends string = string> {
  options: readonly SegmentOption<V>[];
  value?: V | undefined;
  onChange?: ((value: V) => void) | undefined;
  label?: string | undefined;
}

export function SegmentedControl<V extends string = string>({ options, label }: SegmentedControlProps<V>) {
  return (
    <div aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button">
          {option.label}
        </button>
      ))}
    </div>
  );
}
