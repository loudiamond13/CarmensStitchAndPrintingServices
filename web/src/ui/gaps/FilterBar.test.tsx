// WEB-06, A11Y-01, PERF-03 (02-UI-SPEC SPEC-GAP "SearchBox" and "FilterBar"; UI considerations zero-one-many and
// overflow, FilterBar chips): the App. E.7 toolbar, search box, result bar and filter chips.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { Select } from '@/ui';
import { FilterBar, FilterChip, ResultBar } from './FilterBar';
import { SearchBox } from './SearchBox';

/** A parent that keeps the search the way the list hook does: trimmed, blank as empty (normalizeSearch). */
function NormalizingParent({ onValue }: { onValue?: (value: string) => void }) {
  const [search, setSearch] = useState('');
  return (
    <>
      <SearchBox
        value={search}
        placeholder="Order no., customer or team"
        onChange={(next) => {
          setSearch(next.trim());
          onValue?.(next);
        }}
        onSubmit={vi.fn()}
      />
      <button
        type="button"
        onClick={() => {
          setSearch('');
        }}
      >
        Reset
      </button>
    </>
  );
}

describe('SearchBox (App. E.7)', () => {
  it('renders the 12px "Search" label over .s-search-box with a search icon and a type=search input', async () => {
    const { container } = render(
      <SearchBox value="" placeholder="Order no., customer or team" onChange={vi.fn()} onSubmit={vi.fn()} />,
    );
    const input = screen.getByRole('searchbox', { name: 'Search' });
    expect(input).toHaveAttribute('type', 'search');
    expect(input).toHaveAttribute('maxlength', '100');
    expect(input).toHaveAttribute('placeholder', 'Order no., customer or team');
    const field = container.firstElementChild as HTMLElement;
    expect(field).toHaveClass('s-search');
    expect(field.style.display).toBe('flex');
    expect(field.style.flexDirection).toBe('column');
    expect(field.style.flex).toBe('1 1 260px');
    const label = field.querySelector('label');
    expect(label).toHaveClass('csp-label');
    expect(label?.style.fontSize).toBe('12px');
    expect(label?.style.lineHeight).toBe('16px');
    const box = field.querySelector('.s-search-box');
    expect(box?.firstElementChild).toHaveClass('lucide-search');
    expect(box?.firstElementChild).toHaveAttribute('width', '18');
    expect(box?.lastElementChild).toBe(input);
    await expectNoAxeViolations(container);
  });

  it('takes a list-specific label and id', () => {
    render(<SearchBox id="u-q" label="Find" value="" placeholder="Name" onChange={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByRole('searchbox', { name: 'Find' })).toHaveAttribute('id', 'u-q');
  });

  it('reports every edit and keeps the space between words while the parent trims its copy', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<NormalizingParent onValue={onValue} />);
    const input = screen.getByRole('searchbox', { name: 'Search' });
    await user.type(input, 'red jersey');
    expect(input).toHaveValue('red jersey');
    expect(onValue).toHaveBeenLastCalledWith('red jersey');
    expect(onValue).toHaveBeenCalledWith('red ');
  });

  it('shows a new value from outside (a cleared chip, Back) in the box', async () => {
    const user = userEvent.setup();
    render(<NormalizingParent />);
    const input = screen.getByRole('searchbox', { name: 'Search' });
    await user.type(input, 'jersey');
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(input).toHaveValue('');
  });

  it('submits the current text on Enter', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SearchBox value="" placeholder="Name or email" onChange={vi.fn()} onSubmit={onSubmit} />);
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'jomar{Enter}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('jomar');
  });
});

describe('FilterBar (App. E.7 .s-toolbar)', () => {
  it('is a .s-toolbar search landmark holding the search, the selects and an optional .s-toolbar-end', async () => {
    const { container } = render(
      <FilterBar end={<span>View</span>}>
        <SearchBox value="" placeholder="Order no., customer or team" onChange={vi.fn()} onSubmit={vi.fn()} />
        <Select label="Status" options={[{ value: 'active', label: 'Active + recent' }]} defaultValue="active" />
      </FilterBar>,
    );
    const toolbar = screen.getByRole('search');
    expect(toolbar).toHaveClass('s-toolbar');
    expect(toolbar.firstElementChild).toHaveClass('s-search');
    expect(toolbar.lastElementChild).toHaveClass('s-toolbar-end');
    expect(toolbar.lastElementChild?.textContent).toBe('View');
    await expectNoAxeViolations(container);
  });

  it('leaves out .s-toolbar-end when there is nothing for it, and takes a landmark name', () => {
    const { container } = render(
      <FilterBar label="Filter orders">
        <SearchBox value="" placeholder="Order no." onChange={vi.fn()} onSubmit={vi.fn()} />
      </FilterBar>,
    );
    expect(screen.getByRole('search', { name: 'Filter orders' })).toBeInTheDocument();
    expect(container.querySelector('.s-toolbar-end')).toBeNull();
  });
});

describe('ResultBar and FilterChip (UI considerations zero-one-many and chip overflow)', () => {
  it('reads "Showing 1 order" for one', () => {
    const { container } = render(<ResultBar count={1} thing="order" things="orders" />);
    const bar = container.querySelector('.s-resultbar');
    expect(bar?.firstElementChild?.textContent).toBe('Showing 1 order');
    const strong = bar?.querySelector('strong');
    expect(strong?.textContent).toBe('1');
    expect(strong?.style.color).toBe('var(--ink)');
  });

  it('reads "Showing 12 orders · sorted by due date" for many', () => {
    const { container } = render(<ResultBar count={12} thing="order" things="orders" sortLabel="due date" />);
    expect(container.querySelector('.s-resultbar > span')?.textContent).toBe('Showing 12 orders · sorted by due date');
  });

  it('renders nothing for zero, because the empty state takes over', () => {
    const { container } = render(<ResultBar count={0} thing="order" things="orders" sortLabel="due date" />);
    expect(container.innerHTML).toBe('');
  });

  it('keeps the chips at zero so a filter can still be cleared one at a time', () => {
    const { container } = render(
      <ResultBar count={0} thing="order" things="orders">
        <FilterChip label="Status" value="Ready" onClear={vi.fn()} />
      </ResultBar>,
    );
    expect(container.querySelector('.s-resultbar')?.textContent).toBe('Status: Ready');
    expect(screen.getByRole('button', { name: 'Clear status filter' })).toBeInTheDocument();
  });

  it('renders a chip "Status: Active + recent" with a 22px clear button named "Clear status filter"', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    const { container } = render(
      <ResultBar count={12} thing="order" things="orders" sortLabel="due date">
        <FilterChip label="Status" value="Active + recent" onClear={onClear} />
      </ResultBar>,
    );
    const chip = container.querySelector('.csp-filter-chips > .s-filter-chip');
    expect(chip).not.toBeNull();
    const label = chip?.querySelector('.csp-filter-chip-label');
    expect(label?.childNodes).toHaveLength(1);
    expect(label?.textContent).toBe('Status: Active + recent');
    const clear = screen.getByRole('button', { name: 'Clear status filter' });
    expect(clear).toHaveClass('s-iconbtn');
    expect(clear).toHaveAttribute('type', 'button');
    expect(clear.style.width).toBe('22px');
    expect(clear.style.height).toBe('22px');
    expect(clear.style.color).toBe('inherit');
    expect(clear.querySelector('svg')).toHaveClass('lucide-x');
    expect(clear.querySelector('svg')).toHaveAttribute('width', '14');
    await user.click(clear);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('has no chip group when no filter differs from its default', () => {
    const { container } = render(
      <ResultBar count={12} thing="order" things="orders">
        {false}
      </ResultBar>,
    );
    expect(container.querySelector('.csp-filter-chips')).toBeNull();
    expect(container.querySelector('.s-filter-chip')).toBeNull();
  });

  it('passes axe with four chips, each clear button named after its filter', async () => {
    const { container } = render(
      <ResultBar count={3} thing="order" things="orders" sortLabel="due date">
        <FilterChip label="Status" value="Active + recent" onClear={vi.fn()} />
        <FilterChip label="Order date" value="Last 90 days" onClear={vi.fn()} />
        <FilterChip
          label="Product type"
          value="Full-sublimation jersey with a very long custom name"
          onClear={vi.fn()}
        />
        <FilterChip label="Sort by" value="Balance (highest)" onClear={vi.fn()} />
      </ResultBar>,
    );
    expect(container.querySelectorAll('.s-filter-chip')).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Clear order date filter' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear product type filter' })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });
});
