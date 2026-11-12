// SPEC-GAP: phone numbers field
// PhoneNumbersField (UI-SPEC S1 card 3; D-23, OR-3; plan 11-12): one to four phone rows inside the Business Info form, with one "Main
// number" the Call buttons dial. Each row has a Number (tel), an optional Label, one radio of a native radio group, and, from the
// second row on, Remove. It reads and writes the `phones` list of the surrounding form (FormProvider).
//   - The first row starts as the main number (the saved settings put the main number first).
//   - Removing the main row makes the first remaining row the main number and says so in a polite line.
//   - Add Number focuses the new Number; a removal focuses the next row's Number, else the previous one, else Add Number.
//   - At four rows Add Number is hidden and a note says you can list up to 4 numbers.
//   - A row reads its own number and main flag as single values (useWatch on the field), never through the list's row objects, which the
//     form changes in place.
import { useEffect, useRef, useState } from 'react';
import { Controller, useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { Button } from '@/components/actions';
import { Icon } from '@/components/brand';
import {
  radioCellClasses,
  radioDotClasses,
  radioInputClasses,
  radioLabelClasses,
  radioRowClasses,
} from '@/components/entry/entry.recipe';
import { Field, messageClasses } from '@/components/forms';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { Note } from '@/components/states';
import {
  phoneControlCellClasses,
  phoneFieldCellClasses,
  phoneListClasses,
  phoneRowClasses,
} from '@/modules/admin/components/siteContent.recipe';
import { SITE_CONTENT_COPY } from '@/modules/admin/siteContentCopy';
import { MAX_PHONES, type BusinessInfoInput } from '@/modules/admin/siteContentSchemas';

const COPY = SITE_CONTENT_COPY.business.phones;
const MAIN_NAME = 'main-phone';

type RowField = 'number' | 'label' | 'isMain';

/** The form path of one field of one row; the template type is what the form's typed paths need. */
function rowName<F extends RowField>(index: number, field: F): `phones.${number}.${F}` {
  return `phones.${String(index)}.${field}` as `phones.${number}.${F}`;
}

/** Where focus goes once the render that shows the change has happened: a row's Number, or the Add Number button. */
type FocusTarget = number | 'add';

interface PhoneRowProps {
  index: number;
  onMain: (index: number) => void;
  onRemove: (index: number) => void;
}

function PhoneRow({ index, onMain, onRemove }: PhoneRowProps) {
  const { control } = useFormContext<BusinessInfoInput>();
  const number = useWatch({ control, name: rowName(index, 'number') }).trim();
  const isMain = useWatch({ control, name: rowName(index, 'isMain') });
  const position = index + 1;
  return (
    <div className={phoneRowClasses}>
      <Controller
        control={control}
        name={rowName(index, 'number')}
        render={({ field, fieldState }) => (
          <Field
            className={phoneFieldCellClasses}
            label={COPY.number.label}
            placeholder={COPY.number.placeholder}
            type="tel"
            autoComplete="tel"
            required
            name={field.name}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message ?? ''}
          />
        )}
      />
      <Controller
        control={control}
        name={rowName(index, 'label')}
        render={({ field, fieldState }) => (
          <Field
            className={phoneFieldCellClasses}
            label={COPY.label.label}
            placeholder={COPY.label.placeholder}
            autoComplete="off"
            name={field.name}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message ?? ''}
          />
        )}
      />
      <div className={phoneControlCellClasses}>
        <label className={radioRowClasses}>
          <span className={radioCellClasses}>
            <input
              type="radio"
              className={radioInputClasses}
              name={MAIN_NAME}
              checked={isMain}
              onChange={() => {
                onMain(index);
              }}
            />
            <span className={radioDotClasses} aria-hidden="true" />
          </span>
          <span className={radioLabelClasses}>
            {COPY.main}
            <span className={srOnlyClasses}>{COPY.mainFor(number === '' ? `number ${String(position)}` : number)}</span>
          </span>
        </label>
      </div>
      <div className={phoneControlCellClasses}>
        {index > 0 && (
          <Button
            variant="ghost-danger"
            icon="x"
            aria-label={COPY.remove(position)}
            onClick={() => {
              onRemove(index);
            }}
          />
        )}
      </div>
    </div>
  );
}

export function PhoneNumbersField() {
  const {
    control,
    getValues,
    setValue,
    formState: { errors },
  } = useFormContext<BusinessInfoInput>();
  const { fields, append, remove } = useFieldArray({ control, name: 'phones' });
  const listRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const focusNext = useRef<FocusTarget | null>(null);
  // The polite line read out after the main number moves because its row was removed.
  const [announcement, setAnnouncement] = useState('');

  // After a render that follows an add or a remove, the cursor goes where the press said.
  useEffect(() => {
    const target = focusNext.current;
    focusNext.current = null;
    if (target === 'add') {
      addRef.current?.focus();
    } else if (target !== null) {
      listRef.current?.querySelector<HTMLInputElement>(`input[name="phones.${String(target)}.number"]`)?.focus();
    }
  });

  const add = (): void => {
    focusNext.current = fields.length;
    setAnnouncement('');
    append({ number: '', label: '', isMain: false }, { shouldFocus: false });
  };

  const removeRow = (index: number): void => {
    const rows = getValues('phones');
    const remaining = rows.filter((_, position) => position !== index);
    const first = remaining[0];
    if (rows[index]?.isMain === true && first !== undefined) {
      // Row 1 cannot be removed, so it is still the first row after this removal.
      setValue('phones.0.isMain', true, { shouldDirty: true });
      const number = first.number.trim();
      setAnnouncement(number === '' ? COPY.nowMainNamed(1) : COPY.nowMain(number));
    } else {
      setAnnouncement('');
    }
    if (first === undefined) {
      focusNext.current = 'add';
    } else {
      focusNext.current = index < remaining.length ? index : index - 1;
    }
    remove(index);
  };

  const makeMain = (index: number): void => {
    setAnnouncement('');
    getValues('phones').forEach((_, position) => {
      setValue(rowName(position, 'isMain'), position === index, { shouldDirty: true });
    });
  };

  const listError = errors.phones?.root?.message;

  return (
    <div className={phoneListClasses} ref={listRef}>
      {fields.map((field, index) => (
        <PhoneRow key={field.id} index={index} onMain={makeMain} onRemove={removeRow} />
      ))}
      {listError !== undefined && (
        <p className={messageClasses({ error: true })}>
          <Icon name="triangle-alert" size={14} />
          {listError}
        </p>
      )}
      {fields.length < MAX_PHONES ? (
        <div>
          <Button ref={addRef} variant="secondary" size="sm" icon="plus" onClick={add}>
            {COPY.add}
          </Button>
        </div>
      ) : (
        <Note icon="info">{COPY.limit}</Note>
      )}
      <div role="status" aria-live="polite" className={srOnlyClasses}>
        {announcement}
      </div>
    </div>
  );
}
