import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/lib/query/queryClient';
import { expectNoAxeViolations } from '@/test/axe';
import { LIZA_ID, ME_ID, PAOLO_ID, problemResponse, staffBackend } from '@/test/expenseFixtures';
import { PaidBySelect } from './PaidBySelect';

// The Paid by picker (CEXP-05, D-18, D-32; plan 06-12): the signed-in user first, then the other staff the lookup returns.

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
});

const ME = { id: ME_ID, name: 'Carmen Reyes' };

function renderSelect(
  props: {
    value?: string;
    onChange?: (id: string) => void;
    error?: string;
    savedPayer?: { id: string; name: string; formerStaff: boolean };
    label?: string;
    name?: string;
    hint?: string;
  } = {},
) {
  return render(
    <QueryClientProvider client={queryClient}>
      <PaidBySelect
        value={props.value ?? ME_ID}
        onChange={props.onChange ?? (() => undefined)}
        currentUser={ME}
        error={props.error}
        savedPayer={props.savedPayer ?? null}
        {...(props.label === undefined ? {} : { label: props.label })}
        {...(props.name === undefined ? {} : { name: props.name })}
        {...(props.hint === undefined ? {} : { hint: props.hint })}
      />
    </QueryClientProvider>,
  );
}

function optionTexts(select: HTMLElement): (string | null)[] {
  return within(select)
    .getAllByRole('option')
    .map((option) => option.textContent);
}

describe('PaidBySelect', () => {
  it('lists the signed-in user first as "{First Last} (you)", preselected, then the others in the lookup order', async () => {
    staffBackend();
    renderSelect();

    const select = screen.getByRole('combobox', { name: /^Paid by/ });
    await waitFor(() => {
      expect(select).toBeEnabled();
    });
    expect(optionTexts(select)).toEqual(['Carmen Reyes (you)', 'Liza Mercado', 'Paolo Garcia']);
    expect(select).toHaveValue(ME_ID);
    expect(screen.getByText('The staff member whose money paid for this.')).toBeInTheDocument();
  });

  it('takes its label, field name and hint from props, so the order windows can say Received by (D-09, D-10, D-11)', async () => {
    staffBackend();
    renderSelect({ label: 'Received by', name: 'receivedByUserId', hint: 'The staff member who took the money.' });

    const select = screen.getByRole('combobox', { name: /^Received by/ });
    await waitFor(() => {
      expect(select).toBeEnabled();
    });
    expect(select).toHaveAttribute('name', 'receivedByUserId');
    expect(screen.getByText('The staff member who took the money.')).toBeInTheDocument();
    expect(screen.queryByText('The staff member whose money paid for this.')).toBeNull();
    expect(screen.queryByRole('combobox', { name: /^Paid by/ })).toBeNull();
    expect(optionTexts(select)).toEqual(['Carmen Reyes (you)', 'Liza Mercado', 'Paolo Garcia']);
    expect(select).toHaveValue(ME_ID);
  });

  it('keeps Paid by and paidByUserId when no label or name is given', async () => {
    staffBackend();
    renderSelect();

    const select = screen.getByRole('combobox', { name: /^Paid by/ });
    await waitFor(() => {
      expect(select).toBeEnabled();
    });
    expect(select).toHaveAttribute('name', 'paidByUserId');
  });

  it('offers only the people the staff lookup returns (never the company or anyone else)', async () => {
    staffBackend([{ id: PAOLO_ID, name: 'Paolo Garcia' }]);
    renderSelect({ value: PAOLO_ID });

    const select = screen.getByRole('combobox', { name: /^Paid by/ });
    await waitFor(() => {
      expect(select).toBeEnabled();
    });
    expect(optionTexts(select)).toEqual(['Paolo Garcia']);
  });

  it('reports the chosen person by id', async () => {
    staffBackend();
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderSelect({ onChange });
    const select = screen.getByRole('combobox', { name: /^Paid by/ });
    await waitFor(() => {
      expect(select).toBeEnabled();
    });

    await user.selectOptions(select, 'Liza Mercado');

    expect(onChange).toHaveBeenCalledWith(LIZA_ID);
  });

  it('is disabled and reads "Loading staff…" while the lookup loads', async () => {
    staffBackend(async () => {
      await delay(50);
      return [{ id: ME_ID, name: 'Carmen Reyes' }];
    });
    renderSelect();

    const select = screen.getByRole('combobox', { name: /^Paid by/ });
    expect(select).toBeDisabled();
    expect(within(select).getByRole('option', { name: 'Loading staff…' })).toBeInTheDocument();
    await waitFor(() => {
      expect(select).toBeEnabled();
    });
  });

  it('says the list could not load, under the field, and stays disabled', async () => {
    staffBackend(() => problemResponse(500));
    renderSelect();

    expect(await screen.findByText("Couldn't load the staff list. Close this form and try again.")).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /^Paid by/ })).toBeDisabled();
  });

  it('shows a given error in place of the hint and has no axe violations', async () => {
    staffBackend();
    renderSelect({ error: 'Choose who paid.' });
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /^Paid by/ })).toBeEnabled();
    });

    expect(screen.getByText('Choose who paid.')).toBeInTheDocument();
    expect(screen.queryByText('The staff member whose money paid for this.')).toBeNull();
    await expectNoAxeViolations(document.body);
  });

  describe('the saved payer of an edit (OQ-7)', () => {
    const OLD = { id: '00000000-0000-4000-8000-0000000000b1', name: 'Old Helper', formerStaff: false };

    it('keeps a saved payer the lookup no longer holds, selected as "{name} (inactive)"', async () => {
      staffBackend();
      renderSelect({ value: OLD.id, savedPayer: OLD });
      const select = screen.getByRole('combobox', { name: /^Paid by/ });
      await waitFor(() => {
        expect(select).toBeEnabled();
      });

      expect(optionTexts(select)).toEqual([
        'Carmen Reyes (you)',
        'Liza Mercado',
        'Paolo Garcia',
        'Old Helper (inactive)',
      ]);
      expect(select).toHaveValue(OLD.id);
    });

    it('reads "{name} (former staff)" when the payer account was deleted', async () => {
      staffBackend();
      renderSelect({ value: OLD.id, savedPayer: { ...OLD, formerStaff: true } });
      const select = screen.getByRole('combobox', { name: /^Paid by/ });
      await waitFor(() => {
        expect(select).toBeEnabled();
      });

      expect(optionTexts(select)).toContain('Old Helper (former staff)');
    });

    it('adds nothing when the saved payer is still in the lookup', async () => {
      staffBackend();
      renderSelect({ value: LIZA_ID, savedPayer: { id: LIZA_ID, name: 'Liza Mercado', formerStaff: false } });
      const select = screen.getByRole('combobox', { name: /^Paid by/ });
      await waitFor(() => {
        expect(select).toBeEnabled();
      });

      expect(optionTexts(select)).toEqual(['Carmen Reyes (you)', 'Liza Mercado', 'Paolo Garcia']);
    });
  });
});
