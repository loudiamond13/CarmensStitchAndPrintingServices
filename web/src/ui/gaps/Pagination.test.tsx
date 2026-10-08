// WEB-06, A11Y-01 (02-UI-SPEC SPEC-GAP "Pagination"; UI consideration: empty, Pagination): Previous / "Page p of n" /
// Next with an optional "Rows per page" select, hidden for one page or none, and focus moved to the results after a
// page change. The push/replace history rules are proven end to end in listState.integration.test.tsx.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { Pagination } from './Pagination';

describe('Pagination (WEB-06)', () => {
  it.each([0, 1])('renders nothing for %i page(s)', (pageCount) => {
    const { container } = render(<Pagination page={1} pageCount={pageCount} onPageChange={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('is a nav named "Pagination" with Previous, "Page 2 of 5" and Next', async () => {
    const { container } = render(<Pagination page={2} pageCount={5} onPageChange={vi.fn()} />);
    const nav = screen.getByRole('navigation', { name: 'Pagination' });
    expect(nav).toHaveClass('csp-pagination');
    const status = nav.querySelector('.csp-pagination-status');
    expect(status?.textContent).toBe('Page 2 of 5');
    expect(status).toHaveClass('body-sm');
    expect([...(status?.querySelectorAll('strong') ?? [])].map((strong) => strong.textContent)).toEqual(['2', '5']);
    for (const strong of status?.querySelectorAll('strong') ?? []) {
      expect(strong).toHaveClass('csp-money');
    }
    const previous = screen.getByRole('button', { name: 'Previous page' });
    const next = screen.getByRole('button', { name: 'Next page' });
    expect(previous).toHaveClass('csp-btn', 'csp-btn-secondary', 'csp-btn-md');
    expect(next).toHaveClass('csp-btn', 'csp-btn-secondary', 'csp-btn-md');
    expect(previous.textContent).toBe('Previous');
    expect(next.textContent).toBe('Next');
    expect(previous.querySelector('svg')).toHaveClass('lucide-chevron-left');
    expect(next.lastElementChild).toHaveClass('lucide-chevron-right');
    expect(previous).toBeEnabled();
    expect(next).toBeEnabled();
    await expectNoAxeViolations(container);
  });

  it('disables Previous on page 1 and Next on the last page', () => {
    const { rerender } = render(<Pagination page={1} pageCount={5} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled();
    rerender(<Pagination page={5} pageCount={5} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  it('calls onPageChange with the next and previous page and moves focus to the focus target', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <>
        <h2 id="orders-heading" tabIndex={-1}>
          Orders
        </h2>
        <Pagination page={2} pageCount={5} onPageChange={onPageChange} focusTargetId="orders-heading" />
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenLastCalledWith(3);
    expect(screen.getByRole('heading', { name: 'Orders' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(onPageChange).toHaveBeenLastCalledWith(1);
    expect(onPageChange).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('heading', { name: 'Orders' })).toHaveFocus();
  });

  it('keeps focus where it is when there is no focus target', async () => {
    const user = userEvent.setup();
    render(<Pagination page={2} pageCount={5} onPageChange={vi.fn()} focusTargetId="missing" />);
    const next = screen.getByRole('button', { name: 'Next page' });
    await user.click(next);
    expect(next).toHaveFocus();
  });

  it('offers "Rows per page" 10/20/50/100 and reports the chosen size', async () => {
    const user = userEvent.setup();
    const onPageSizeChange = vi.fn();
    const { container } = render(
      <Pagination page={2} pageCount={5} onPageChange={vi.fn()} pageSize={20} onPageSizeChange={onPageSizeChange} />,
    );
    const select = screen.getByRole('combobox', { name: 'Rows per page' });
    expect(select).toHaveValue('20');
    expect([...select.querySelectorAll('option')].map((option) => option.textContent)).toEqual([
      '10',
      '20',
      '50',
      '100',
    ]);
    expect(select.closest('.s-toolbar-end')).not.toBeNull();
    await user.selectOptions(select, '50');
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
    await expectNoAxeViolations(container);
  });

  it('takes the page sizes a list offers', () => {
    render(
      <Pagination
        page={1}
        pageCount={2}
        onPageChange={vi.fn()}
        pageSize={10}
        pageSizes={[10, 20]}
        onPageSizeChange={vi.fn()}
      />,
    );
    const options = screen.getByRole('combobox', { name: 'Rows per page' }).querySelectorAll('option');
    expect([...options].map((option) => option.value)).toEqual(['10', '20']);
  });

  it('has no size select unless the list handles size changes', () => {
    render(<Pagination page={1} pageCount={2} onPageChange={vi.fn()} pageSize={20} />);
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('moves no focus without a focus target id', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination page={2} pageCount={5} onPageChange={onPageChange} />);
    const next = screen.getByRole('button', { name: 'Next page' });
    await user.click(next);
    expect(onPageChange).toHaveBeenCalledWith(3);
    expect(next).toHaveFocus();
  });

  it('keeps its markup when re-rendered with equal props (compiler cache path)', () => {
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();
    const props = { page: 2, pageCount: 5, onPageChange, pageSize: 20, onPageSizeChange, focusTargetId: 'x' };
    const { container, rerender } = render(<Pagination {...props} />);
    const before = container.innerHTML;
    rerender(<Pagination {...props} />);
    expect(container.innerHTML).toBe(before);
  });
});
