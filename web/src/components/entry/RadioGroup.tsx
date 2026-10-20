// SPEC-GAP: RadioGroup (UI-SPEC "RadioGroup", OQ-10, D-47; plan 05-22). A borderless fieldset whose legend has the label
// look, holding native radios. Each option is a label row with the round control (the P2 D-03 checkbox look: 2px --ink
// border, --surface-2 ground, an --accent ground and an --on-accent dot when checked), then the option label over an
// optional one-line description. The whole row is the click target, 44px tall at least, and the text wraps beside the
// control so a long description grows the row instead of clipping. Arrow keys move and select natively. The radio is named
// by its label and described by its description. The dot is an aria-hidden sibling shown by `peer-checked:`.
import clsx from 'clsx';
import { useId, type ReactNode } from 'react';
import { labelClasses } from '@/components/forms';
import {
  radioCellClasses,
  radioDescriptionClasses,
  radioDotClasses,
  radioGroupClasses,
  radioInputClasses,
  radioLabelClasses,
  radioLegendClasses,
  radioRowClasses,
  radioTextClasses,
} from './entry.recipe';

export interface RadioOption<V extends string = string> {
  value: V;
  label: ReactNode;
  /** One short line under the label. */
  description?: ReactNode;
}

export interface RadioGroupProps<V extends string = string> {
  /** Names the group: the fieldset's legend. */
  legend: ReactNode;
  /** The radios' shared name. */
  name: string;
  /** The selected option's value. */
  value: V;
  onChange: (value: V) => void;
  options: readonly RadioOption<V>[];
}

export function RadioGroup<V extends string = string>({ legend, name, value, onChange, options }: RadioGroupProps<V>) {
  const base = useId();
  return (
    <fieldset className={radioGroupClasses}>
      <legend className={clsx(labelClasses, radioLegendClasses)}>{legend}</legend>
      {options.map((option, index) => {
        const labelId = `${base}-${String(index)}-label`;
        const descriptionId = `${base}-${String(index)}-description`;
        const hasDescription = option.description !== undefined && option.description !== null;
        return (
          <label key={option.value} className={radioRowClasses}>
            <span className={radioCellClasses}>
              <input
                type="radio"
                className={radioInputClasses}
                name={name}
                value={option.value}
                checked={option.value === value}
                aria-labelledby={labelId}
                aria-describedby={hasDescription ? descriptionId : undefined}
                onChange={() => {
                  onChange(option.value);
                }}
              />
              <span className={radioDotClasses} aria-hidden="true" />
            </span>
            <span className={radioTextClasses}>
              <span id={labelId} className={radioLabelClasses}>
                {option.label}
              </span>
              {hasDescription && (
                <span id={descriptionId} className={radioDescriptionClasses}>
                  {option.description}
                </span>
              )}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
