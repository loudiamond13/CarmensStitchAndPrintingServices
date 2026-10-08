// SegmentedControl (App. D.3 "Forms", CSPS-UI-SPEC.md §6.3), converted to utilities (D-33) with the same props API and
// markup: a radio group (one div) of `role="radio"` buttons with `aria-checked`; icon-only options keep `aria-label` and
// `title`. The `.is-on` look keys off `aria-checked` (choice.recipe.ts). The 32px segment height is kept by owner
// ruling (D-31 O-8).
// SPEC-DEVIATION: A11Y-02 roving tabIndex and arrow keys (UI-SPEC Interaction Contract): only the checked radio is in
// the Tab order (0, the others -1), and Right/Down and Left/Up move the selection and the focus, wrapping at both ends
// (WAI-ARIA radio group). App. D.3 put every segment in the Tab order and had no arrow keys. No element is added.
import { useRef, useState, type KeyboardEvent } from 'react';
import { Icon, type IconName } from '@/ui/brand';
import { segmentClasses, segmentedClasses } from './choice.recipe';
import { rovingItem } from './roving';

export interface SegmentOption<V extends string = string> {
  value: V;
  label: string;
  icon?: IconName | undefined;
  /** Show the label next to the icon; an icon option without it is icon-only and named by `aria-label`. */
  showLabel?: boolean | undefined;
}

export interface SegmentedControlProps<V extends string = string> {
  options: readonly SegmentOption<V>[];
  /** The checked value; without it the control keeps its own, starting at the first option (App. D.3). */
  value?: V | undefined;
  onChange?: ((value: V) => void) | undefined;
  /** Names the group of radios. */
  label?: string | undefined;
}

export function SegmentedControl<V extends string = string>({
  options,
  value,
  onChange,
  label,
}: SegmentedControlProps<V>) {
  const [inner, setInner] = useState<V | undefined>(value ?? options[0]?.value);
  const segments = useRef<(HTMLButtonElement | null)[]>([]);
  const current = value ?? inner;
  // The radio in the Tab order: the checked one, or the first when no option is checked (WAI-ARIA radio group).
  const focusable = options.some((option) => option.value === current) ? current : options[0]?.value;

  const select = (next: V): void => {
    setInner(next);
    onChange?.(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const target = rovingItem(options, index, event.key, 'radio');
    if (target === undefined) {
      return;
    }
    event.preventDefault();
    select(target.item.value);
    segments.current[target.index]?.focus();
  };

  return (
    <div className={segmentedClasses} role="radiogroup" aria-label={label}>
      {options.map((option, index) => {
        const checked = current === option.value;
        const iconOnly = option.icon !== undefined && option.showLabel !== true;
        return (
          <button
            key={option.value}
            ref={(element) => {
              segments.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={option.value === focusable ? 0 : -1}
            className={segmentClasses}
            onClick={() => {
              select(option.value);
            }}
            onKeyDown={(event) => {
              handleKeyDown(event, index);
            }}
            aria-label={iconOnly && option.label !== '' ? option.label : undefined}
            title={option.label}
          >
            {option.icon !== undefined && <Icon name={option.icon} size={18} />}
            {!iconOnly && <span>{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
