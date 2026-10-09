import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { kit } from '@/dev/kit';
import { renderNode } from '@/dev/renderScenario';
import { scenarios as listsStates } from '@/dev/scenarios/groups/lists-states';
import { expectNoAxeViolations } from '@/test/axe';
import { LISTS_COPY, Pagination, type PaginationProps } from '@/ui/lists';

// Pagination (SPEC-GAP, plan 02-30; UI-SPEC "SPEC-GAP Primitive Specs" → Pagination, Copywriting "Pagination"; WEB-06,
// WEB-10, A11Y-01). A `nav` named "Pagination" with Previous / "Page {p} of {n}" / Next and an optional "Rows per page"
// size. The caller wires `onPageChange` to the list hook's setPage (a push) and `onPageSizeChange` to setPageSize (a
// replace that resets the page); listState.integration.test.tsx proves the history in a real data router. axe on real
// timers (L-24).

function tokens(classes: string | null | undefined): string[] {
  return (classes ?? '').split(/\s+/).filter(Boolean).sort();
}

function renderPagination(overrides: Partial<PaginationProps> = {}) {
  const onPageChange = vi.fn<(page: number) => void>();
  const view = render(
    <>
      <h2 id="users-results" tabIndex={-1}>
        Users
      </h2>
      <Pagination page={2} pageCount={5} onPageChange={onPageChange} focusTargetId="users-results" {...overrides} />
    </>,
  );
  return { ...view, onPageChange };
}

describe('Pagination (SPEC-GAP, WEB-06, WEB-10)', () => {
  it('is a nav named "Pagination" with Previous, "Page 2 of 5" and Next', () => {
    renderPagination();
    const nav = screen.getByRole('navigation', { name: LISTS_COPY.pagination.label });
    expect(nav).toHaveTextContent('Page 2 of 5');
    expect(screen.getByRole('button', { name: 'Previous page' })).toHaveTextContent('Previous');
    expect(screen.getByRole('button', { name: 'Next page' })).toHaveTextContent('Next');
    const numbers = nav.querySelectorAll('strong');
    expect([...numbers].map((number) => number.textContent)).toEqual(['2', '5']);
    expect(tokens(numbers[0]?.className)).toEqual(['font-semibold', 'tabular-nums', 'text-ink']);
  });

  it.each([0, 1])('is not rendered for %i page(s)', (pageCount) => {
    const { container } = render(<Pagination page={1} pageCount={pageCount} onPageChange={() => undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('disables Previous on page 1 and Next on the last page', () => {
    const { rerender } = render(<Pagination page={1} pageCount={3} onPageChange={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled();

    rerender(<Pagination page={3} pageCount={3} onPageChange={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  it('calls the page setter (the push) with the next page and moves focus to the results heading', async () => {
    const user = userEvent.setup();
    const { onPageChange } = renderPagination();
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
    expect(screen.getByRole('heading', { name: 'Users' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(onPageChange).toHaveBeenLastCalledWith(1);
  });

  it('changes the page without moving focus when no focus target is given, or the target is gone', () => {
    const onPageChange = vi.fn();
    const { rerender } = render(<Pagination page={2} pageCount={5} onPageChange={onPageChange} />);
    const next = screen.getByRole('button', { name: 'Next page' });
    next.focus();
    fireEvent.click(next);
    expect(onPageChange).toHaveBeenCalledWith(3);
    expect(next).toHaveFocus();

    rerender(<Pagination page={2} pageCount={5} onPageChange={onPageChange} focusTargetId="missing" />);
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenCalledTimes(2);
  });

  it('offers "Rows per page" 10/20/50/100 and calls the size setter (the replace with page reset)', async () => {
    const user = userEvent.setup();
    const onPageSizeChange = vi.fn();
    renderPagination({ pageSize: 20, onPageSizeChange });
    const size = screen.getByRole('combobox', { name: LISTS_COPY.pagination.rowsPerPage });
    expect(size).toHaveValue('20');
    expect([...size.querySelectorAll('option')].map((option) => option.textContent)).toEqual(['10', '20', '50', '100']);
    await user.selectOptions(size, '50');
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  it('ignores a size outside 10/20/50/100 (a tampered option)', () => {
    const onPageSizeChange = vi.fn();
    renderPagination({ pageSize: 20, onPageSizeChange });
    const size = screen.getByRole('combobox', { name: LISTS_COPY.pagination.rowsPerPage });
    const forged = document.createElement('option');
    forged.value = '9999';
    size.append(forged);
    fireEvent.change(size, { target: { value: '9999' } });
    expect(onPageSizeChange).not.toHaveBeenCalled();
  });

  it('shows no size select without a size setter', () => {
    renderPagination({ pageSize: 20 });
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('turns the buttons into 44px icons on phones while keeping their names', () => {
    renderPagination();
    for (const name of ['Previous page', 'Next page']) {
      const button = screen.getByRole('button', { name });
      expect(tokens(button.className)).toEqual(
        expect.arrayContaining(['pg-phone:w-11', 'pg-phone:px-0', 'pg-phone:[&>span]:hidden']),
      );
      expect(button.querySelector('svg')).not.toBeNull();
    }
  });

  it('has no axe violations, with and without the size select', async () => {
    const plain = renderPagination();
    await expectNoAxeViolations(plain.container);
    plain.unmount();
    const sized = renderPagination({ pageSize: 50, onPageSizeChange: () => undefined });
    await expectNoAxeViolations(sized.container);
  });

  it('re-renders from the React Compiler memo cache with the same output, and updates on new props', () => {
    const onPageChange = vi.fn();
    const { rerender } = render(<Pagination page={2} pageCount={5} onPageChange={onPageChange} />);
    rerender(<Pagination page={2} pageCount={5} onPageChange={onPageChange} />);
    expect(screen.getByRole('navigation')).toHaveTextContent('Page 2 of 5');
    rerender(<Pagination page={4} pageCount={9} onPageChange={onPageChange} />);
    expect(screen.getByRole('navigation')).toHaveTextContent('Page 4 of 9');
  });
});

describe('pagination scenarios (lists-states group)', () => {
  it('declares first, middle and last pages, implementation only, and renders them with no axe violations', async () => {
    const cases = listsStates.filter((scenario) => scenario.id.startsWith('pagination-'));
    expect(cases.map((scenario) => scenario.id)).toEqual(['pagination-first', 'pagination-middle', 'pagination-last']);
    for (const scenario of cases) {
      expect(scenario.parity, scenario.id).toBe(false);
      const view = render(renderNode(kit, scenario.node, scenario.handlers ?? []));
      expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
      await expectNoAxeViolations(view.container);
      view.unmount();
    }
  });
});
