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

function renderSelect(props: { value?: string; onChange?: (id: string) => void; error?: string } = {}) {
  return render(
    <QueryClientProvider client={queryClient}>
      <PaidBySelect
        value={props.value ?? ME_ID}
        onChange={props.onChange ?? (() => undefined)}
        currentUser={ME}
        error={props.error}
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
});
