import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { PhoneNumbersField } from '@/modules/admin/components/PhoneNumbersField';
import type { BusinessInfoInput } from '@/modules/admin/siteContentSchemas';
import { businessInfoValuesOf } from '@/modules/admin/siteContentSchemas';
import { expectNoAxeViolations } from '@/test/axe';
import { demoSiteSettings } from '@/test/siteContentFixtures';

// PhoneNumbersField (D-23; plan 11-12): one to four rows, one native "Main number" radio group, add and remove with the focus rules.

type Row = BusinessInfoInput['phones'][number];

const GLOBE: Row = { number: '0917 123 4567', label: 'Globe', isMain: true };
const LANDLINE: Row = { number: '02 8123 4567', label: '', isMain: false };
const SMART: Row = { number: '0918 123 4567', label: '', isMain: false };
const SUN: Row = { number: '0922 123 4567', label: '', isMain: false };

/** The current rows, printed so a test can read what the form holds. */
function Harness({ phones }: { phones: Row[] }) {
  const form = useForm<BusinessInfoInput>({ defaultValues: { ...businessInfoValuesOf(demoSiteSettings), phones } });
  return (
    <FormProvider {...form}>
      <PhoneNumbersField />
      <output aria-label="values">{JSON.stringify(form.watch('phones'))}</output>
    </FormProvider>
  );
}

function renderField(phones: Row[]) {
  const view = render(<Harness phones={phones} />);
  return { ...view, user: userEvent.setup() };
}

function heldRows(): Row[] {
  return JSON.parse(screen.getByLabelText('values').textContent) as Row[];
}

function numberFields(): HTMLElement[] {
  return screen.getAllByLabelText(/^Number/);
}

describe('the rows', () => {
  it('shows a Number and a Label field and a Main number radio for each row, in order', () => {
    renderField([GLOBE, LANDLINE]);

    expect(numberFields().map((field) => (field as HTMLInputElement).value)).toEqual(['0917 123 4567', '02 8123 4567']);
    expect(screen.getAllByLabelText(/^Label \(optional\)/).map((field) => (field as HTMLInputElement).value)).toEqual([
      'Globe',
      '',
    ]);
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('makes each Number a tel field that the browser can fill in', () => {
    renderField([GLOBE]);

    const field = numberFields()[0];
    expect(field).toHaveAttribute('type', 'tel');
    expect(field).toHaveAttribute('autocomplete', 'tel');
    expect(field).toBeRequired();
  });

  it('names each radio "Main number, {number}" and groups them as one native radio group', () => {
    renderField([GLOBE, LANDLINE]);

    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toHaveAccessibleName('Main number, 0917 123 4567');
    expect(radios[1]).toHaveAccessibleName('Main number, 02 8123 4567');
    expect(new Set(radios.map((radio) => radio.getAttribute('name'))).size).toBe(1);
    expect(radios[0]).toBeChecked();
    expect(radios[1]).not.toBeChecked();
  });

  it('moves the main number with the radio and keeps exactly one main row', async () => {
    const { user } = renderField([GLOBE, LANDLINE]);

    await user.click(screen.getAllByRole('radio')[1] as HTMLElement);

    expect(heldRows().map((row) => row.isMain)).toEqual([false, true]);
    expect(screen.getAllByRole('radio')[1]).toBeChecked();
    expect(screen.getAllByRole('radio')[0]).not.toBeChecked();
  });

  it('follows what is typed into the Number in the radio name', async () => {
    const { user } = renderField([GLOBE]);
    const field = numberFields()[0] as HTMLElement;

    await user.clear(field);
    await user.type(field, '0999 000 1111');

    expect(screen.getByRole('radio')).toHaveAccessibleName('Main number, 0999 000 1111');
  });
});

describe('one number (zero, one, many)', () => {
  it('has no remove button on the only row', () => {
    renderField([GLOBE]);

    expect(screen.queryByRole('button', { name: /^Remove number/ })).toBeNull();
  });

  it('has a remove button named for its place on rows 2 to 4 and none on row 1', () => {
    renderField([GLOBE, LANDLINE, SMART]);

    expect(screen.queryByRole('button', { name: 'Remove number 1' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Remove number 2' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Remove number 3' })).toBeVisible();
  });
});

describe('Add Number', () => {
  it('adds an empty row that is not the main number and focuses its Number field', async () => {
    const { user } = renderField([GLOBE]);

    await user.click(screen.getByRole('button', { name: 'Add Number' }));

    expect(numberFields()).toHaveLength(2);
    expect(numberFields()[1]).toHaveFocus();
    expect(heldRows()[1]).toEqual({ number: '', label: '', isMain: false });
  });

  it('is hidden at 4 rows, where the note says you can list up to 4 numbers', async () => {
    const { user } = renderField([GLOBE, LANDLINE, SMART]);
    expect(screen.queryByText('You can list up to 4 numbers.')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Add Number' }));

    expect(screen.queryByRole('button', { name: 'Add Number' })).toBeNull();
    expect(screen.getByText('You can list up to 4 numbers.')).toBeVisible();
    expect(numberFields()).toHaveLength(4);
  });

  it('comes back after a row is removed from four', async () => {
    const { user } = renderField([GLOBE, LANDLINE, SMART, SUN]);
    expect(screen.queryByRole('button', { name: 'Add Number' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Remove number 4' }));

    expect(screen.getByRole('button', { name: 'Add Number' })).toBeVisible();
    expect(screen.queryByText('You can list up to 4 numbers.')).toBeNull();
  });
});

describe('removing a row', () => {
  it('removes that row and keeps the others', async () => {
    const { user } = renderField([GLOBE, LANDLINE, SMART]);

    await user.click(screen.getByRole('button', { name: 'Remove number 2' }));

    expect(heldRows().map((row) => row.number)).toEqual(['0917 123 4567', '0918 123 4567']);
  });

  it('focuses the next row Number after a removal', async () => {
    const { user } = renderField([GLOBE, LANDLINE, SMART]);

    await user.click(screen.getByRole('button', { name: 'Remove number 2' }));

    expect(numberFields()[1]).toHaveFocus();
    expect((numberFields()[1] as HTMLInputElement).value).toBe('0918 123 4567');
  });

  it('focuses the previous row Number after removing the last row', async () => {
    const { user } = renderField([GLOBE, LANDLINE, SMART]);

    await user.click(screen.getByRole('button', { name: 'Remove number 3' }));

    expect(numberFields()[1]).toHaveFocus();
    expect((numberFields()[1] as HTMLInputElement).value).toBe('02 8123 4567');
  });

  it('keeps the main number when another row goes and says nothing about it', async () => {
    const { user } = renderField([GLOBE, LANDLINE, SMART]);

    await user.click(screen.getByRole('button', { name: 'Remove number 3' }));

    expect(heldRows().map((row) => row.isMain)).toEqual([true, false]);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('makes the first remaining row the main number when the main row is removed, and says so', async () => {
    const { user } = renderField([
      { ...GLOBE, isMain: false },
      { ...LANDLINE, isMain: true },
    ]);
    // The main number is the second row: removing it leaves the first row as the only one, so it becomes main.
    await user.click(screen.getByRole('button', { name: 'Remove number 2' }));

    expect(heldRows()).toEqual([{ ...GLOBE, isMain: true }]);
    expect(screen.getByRole('status')).toHaveTextContent('0917 123 4567 is now the main number.');
  });

  it('picks the first remaining row, not the next one, as the new main number', async () => {
    const { user } = renderField([{ ...GLOBE, isMain: false }, { ...LANDLINE, isMain: true }, SMART]);

    await user.click(screen.getByRole('button', { name: 'Remove number 2' }));

    expect(heldRows().map((row) => row.isMain)).toEqual([true, false]);
    expect(screen.getByRole('status')).toHaveTextContent('0917 123 4567 is now the main number.');
  });

  it('names the new main row by its place when it has no number yet', async () => {
    const { user } = renderField([
      { ...GLOBE, number: '', isMain: false },
      { ...LANDLINE, isMain: true },
    ]);

    await user.click(screen.getByRole('button', { name: 'Remove number 2' }));

    expect(screen.getByRole('status')).toHaveTextContent('Number 1 is now the main number.');
  });
});

describe('accessibility', () => {
  it('has no axe violations with three rows', async () => {
    const { container } = renderField([GLOBE, LANDLINE, SMART]);

    await expectNoAxeViolations(container);
  });

  it('has no axe violations at four rows', async () => {
    const { container } = renderField([GLOBE, LANDLINE, SMART, SUN]);

    await expectNoAxeViolations(container);
  });
});
