import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NuqsTestingAdapter, type OnUrlUpdateFunction, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { kit } from '@/dev/kit';
import { renderNode } from '@/dev/renderScenario';
import { scenarios as listsParity } from '@/dev/scenarios/groups/lists';
import { scenarios as listsStates } from '@/dev/scenarios/groups/lists-states';
import { createListParams } from '@/lib/url-state/createListParams';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { literalParser, pageParser, pageSizeParser, searchParser } from '@/lib/url-state/parsers';
import { expectNoAxeViolations } from '@/test/axe';
import { SegmentedControl } from '@/components/choice';
import { Select } from '@/components/forms';
import { FilterBar, FilterChip, LISTS_COPY, ResultBar, SearchBox } from '@/components/lists';

// FilterBar, SearchBox, ResultBar and FilterChip (plan 02-30; UI-SPEC "SPEC-GAP Primitive Specs" → SearchBox and
// FilterBar, Copywriting "Result bar / filter chip"; App. E.7; WEB-06, WEB-08, WEB-10, PERF-03, T-02-66/67). The
// toolbar look is proven against App. E.7 by the parity suite (toolbar-orders); these tests pin the markup, the
// WEB-10 history rules through a real createListParams hook under the nuqs testing adapter, the 300 ms search and axe.
// axe and user-event on real timers only (L-24); fake-timer tests type with fireEvent.

const STATUS_LABELS = { active: 'Active + recent', all: 'All statuses', ready: 'Ready' } as const;
const SORT_LABELS = { due: 'due date', new: 'newest first' } as const;

const useOrdersListParams = createListParams({
  page: pageParser,
  size: pageSizeParser,
  q: searchParser,
  status: literalParser(['active', 'all', 'ready'], 'active'),
  sort: literalParser(['due', 'new'], 'due'),
  view: literalParser(['grid', 'table'], 'grid'),
});

/** An Orders list screen built the WEB-10 way: it reads and writes its state only through the list hook. */
function OrdersToolbar({ count = 12 }: { count?: number }) {
  const [values, set] = useOrdersListParams();
  return (
    <>
      <FilterBar
        end={
          <SegmentedControl
            label="View"
            value={values.view}
            onChange={(view) => {
              set.setFilter('view', view);
            }}
            options={[
              { value: 'grid', label: 'Grid view', icon: 'layout-grid' },
              { value: 'table', label: 'Table view', icon: 'list' },
            ]}
          />
        }
      >
        <SearchBox value={values.q} placeholder="Order no., customer or team" onSearch={set.setSearch} />
        <Select
          label="Status"
          options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
          value={values.status}
          onChange={(event) => {
            set.setFilter('status', event.target.value as keyof typeof STATUS_LABELS);
          }}
        />
        <Select
          label="Sort by"
          options={[
            { value: 'due', label: 'Due date (soonest)' },
            { value: 'new', label: 'Newest first' },
          ]}
          value={values.sort}
          onChange={(event) => {
            set.setFilter('sort', event.target.value as keyof typeof SORT_LABELS);
          }}
        />
      </FilterBar>
      <ResultBar count={count} thing="order" things="orders" sortLabel={SORT_LABELS[values.sort]}>
        {values.status !== 'active' && (
          <FilterChip
            label="Status"
            value={STATUS_LABELS[values.status]}
            onClear={() => {
              set.setFilter('status', null);
            }}
          />
        )}
      </ResultBar>
    </>
  );
}

type UrlUpdateSpy = ReturnType<typeof vi.fn<OnUrlUpdateFunction>>;

function renderToolbar(searchParams = '', count = 12) {
  const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
  const view = render(
    <NuqsTestingAdapter
      searchParams={searchParams}
      onUrlUpdate={onUrlUpdate}
      hasMemory
      defaultOptions={URL_STATE_DEFAULTS}
      processUrlSearchParams={orderSearchParams}
    >
      <OrdersToolbar count={count} />
    </NuqsTestingAdapter>,
  );
  return { ...view, onUrlUpdate };
}

function updates(onUrlUpdate: UrlUpdateSpy): { history: string; query: string }[] {
  return onUrlUpdate.mock.calls.map(([event]: [UrlUpdateEvent]) => ({
    history: event.options.history,
    query: event.queryString,
  }));
}

/** Waits for the first URL update, then long enough for any further queued one (rate limit 0 in the adapter). */
async function settled(onUrlUpdate: UrlUpdateSpy): Promise<void> {
  await waitFor(() => {
    expect(onUrlUpdate).toHaveBeenCalled();
  });
  await new Promise((resolve) => setTimeout(resolve, 30));
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** Types one character at a time, as the browser fires input events (user-event hangs on fake timers). */
function typeInto(input: HTMLElement, text: string): void {
  for (let length = 1; length <= text.length; length += 1) {
    fireEvent.change(input, { target: { value: text.slice(0, length) } });
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe('FilterBar: the App. E.7 toolbar (WEB-06)', () => {
  it('is a search landmark marked data-ui="s-toolbar" with the search, the filters and the toolbar end', () => {
    renderToolbar();
    const toolbar = screen.getByRole('search');
    expect(toolbar).toHaveAttribute('data-ui', 's-toolbar');
    expect(within(toolbar).getByRole('searchbox', { name: 'Search' })).toBeInTheDocument();
    expect(within(toolbar).getByRole('combobox', { name: 'Status' })).toHaveValue('active');
    const view = within(toolbar).getByRole('radiogroup', { name: 'View' });
    expect(view.parentElement?.parentElement).toBe(toolbar);
    expect(view.parentElement).toBe(toolbar.lastElementChild);
  });

  it('names the landmark when asked (a page with two search regions) and leaves out an empty end', () => {
    render(
      <FilterBar label="Filter orders">
        <SearchBox value={null} placeholder="Order no." onSearch={() => undefined} />
      </FilterBar>,
    );
    const toolbar = screen.getByRole('search', { name: 'Filter orders' });
    expect(toolbar.children).toHaveLength(1);
  });

  it('a filter change is one replace that resets the page; the default never reaches the URL', async () => {
    const user = userEvent.setup();
    const { onUrlUpdate } = renderToolbar('?page=3');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'ready');
    await settled(onUrlUpdate);
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?status=ready' }]);
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveValue('ready');
  });

  it('a sort or view change is a replace too', async () => {
    const user = userEvent.setup();
    const { onUrlUpdate } = renderToolbar('?page=2');
    await user.click(screen.getByRole('radio', { name: 'Table view' }));
    await settled(onUrlUpdate);
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?view=table' }]);
  });
});

describe('ResultBar and FilterChip (App. E.7, zero-one-many)', () => {
  it('says "Showing 12 orders · sorted by due date" and shows no chip for the default status', () => {
    renderToolbar();
    expect(screen.getByText(/^Showing/)).toHaveTextContent('Showing 12 orders · sorted by due date');
    expect(screen.queryByRole('button', { name: /^Clear .* filter$/ })).toBeNull();
  });

  it('reads a fixed order phrase as "Showing 3 entries · newest first" (the audit log)', () => {
    render(<ResultBar count={3} thing="entry" things="entries" orderNote="newest first" />);
    expect(screen.getByText(/^Showing/)).toHaveTextContent('Showing 3 entries · newest first');
  });

  it('says "Showing 1 order" for exactly one', () => {
    renderToolbar('', 1);
    expect(screen.getByText(/^Showing/)).toHaveTextContent('Showing 1 order · sorted by due date');
  });

  it('shows one chip per non-default filter, and its clear button is one replace without the filter or the page', async () => {
    const user = userEvent.setup();
    const { onUrlUpdate } = renderToolbar('?page=3&status=ready');
    expect(screen.getByText('Status: Ready')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear status filter' }));
    await settled(onUrlUpdate);
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
    expect(screen.queryByText('Status: Ready')).toBeNull();
  });

  it('renders nothing for zero rows without chips, and only the chips for zero rows with filters', () => {
    const { container, rerender } = render(<ResultBar count={0} thing="order" things="orders" />);
    expect(container).toBeEmptyDOMElement();

    rerender(
      <ResultBar count={0} thing="order" things="orders">
        <FilterChip label="Status" value="Ready" onClear={() => undefined} />
      </ResultBar>,
    );
    expect(screen.queryByText(/^Showing/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Clear status filter' })).toBeInTheDocument();
  });

  it('keeps the whole chip text for assistive technology while the label truncates (overflow edge)', () => {
    const value = 'Brgy. San Roque Ballers and the Tondo Riders MC';
    render(<FilterChip label="Team" value={value} onClear={() => undefined} />);
    const label = screen.getByText(`Team: ${value}`);
    expect(label.className.split(/\s+/)).toEqual(expect.arrayContaining(['min-w-0', 'truncate']));
    expect(label.parentElement?.className.split(/\s+/)).toContain('max-w-full');
    expect(screen.getByRole('button', { name: 'Clear team filter' })).toBeInTheDocument();
    expect(LISTS_COPY.clearFilter('Order date')).toBe('Clear order date filter');
  });
});

describe('SearchBox (WEB-08, WEB-10, SEC-03)', () => {
  it('is a labelled 100-character search box with the list placeholder', () => {
    renderToolbar();
    const search = screen.getByRole('searchbox', { name: LISTS_COPY.search });
    expect(search).toHaveAttribute('type', 'search');
    expect(search).toHaveAttribute('maxlength', '100');
    expect(search).toHaveAttribute('placeholder', 'Order no., customer or team');
  });

  it('writes the URL once, 300 ms after the last keystroke, with replace and a page reset', async () => {
    vi.useFakeTimers();
    const { onUrlUpdate } = renderToolbar('?page=2');
    const search = screen.getByRole('searchbox', { name: 'Search' });
    typeInto(search, 'jersey');
    await advance(250);
    expect(onUrlUpdate).not.toHaveBeenCalled();
    await advance(100);
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?q=jersey' }]);
    expect(search).toHaveValue('jersey');
  });

  it('writes at once on Enter', async () => {
    vi.useFakeTimers();
    const { onUrlUpdate } = renderToolbar('');
    const search = screen.getByRole('searchbox', { name: 'Search' });
    typeInto(search, 'jersey');
    fireEvent.keyDown(search, { key: 'Enter' });
    await advance(10);
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?q=jersey' }]);
    await advance(500);
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?q=jersey' }]);
  });

  it('keeps the space being typed ("red ") and follows a new value from outside (a reset or Back)', () => {
    const onSearch = vi.fn();
    const { rerender } = render(<SearchBox value="red" placeholder="Search orders" onSearch={onSearch} />);
    const search = screen.getByRole('searchbox', { name: 'Search' });
    fireEvent.change(search, { target: { value: 'red ' } });
    rerender(<SearchBox value="red" placeholder="Search orders" onSearch={onSearch} />);
    expect(search).toHaveValue('red ');
    expect(onSearch).toHaveBeenCalledWith('red ');

    rerender(<SearchBox value={null} placeholder="Search orders" onSearch={onSearch} />);
    expect(search).toHaveValue('');
    fireEvent.keyDown(search, { key: 'a' });
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('takes a caller id and label', () => {
    render(
      <SearchBox id="users-q" label="Find a user" value="" placeholder="Name or email" onSearch={() => undefined} />,
    );
    expect(screen.getByRole('searchbox', { name: 'Find a user' })).toHaveAttribute('id', 'users-q');
  });
});

describe('FilterBar accessibility and re-render', () => {
  it('has no axe violations with a chip', async () => {
    const { container } = renderToolbar('?status=ready');
    await expectNoAxeViolations(container);
  });

  it('re-renders from the React Compiler memo cache with the same output, and updates on new props', () => {
    const onClear = vi.fn();
    const { rerender } = render(
      <ResultBar count={3} thing="user" things="users">
        <FilterChip label="Role" value="Admin" onClear={onClear} />
      </ResultBar>,
    );
    rerender(
      <ResultBar count={3} thing="user" things="users">
        <FilterChip label="Role" value="Admin" onClear={onClear} />
      </ResultBar>,
    );
    expect(screen.getByText(/^Showing/)).toHaveTextContent('Showing 3 users');
    rerender(
      <ResultBar count={1} thing="user" things="users" sortLabel="name">
        <FilterChip label="Role" value="Manager" onClear={onClear} />
      </ResultBar>,
    );
    expect(screen.getByText(/^Showing/)).toHaveTextContent('Showing 1 user · sorted by name');
    expect(screen.getByText('Role: Manager')).toBeInTheDocument();

    const { rerender: again } = render(
      <FilterBar>
        <span>one</span>
      </FilterBar>,
    );
    again(
      <FilterBar>
        <span>one</span>
      </FilterBar>,
    );
    again(
      <FilterBar end={<span>end</span>}>
        <span>two</span>
      </FilterBar>,
    );
    expect(screen.getByText('end')).toBeInTheDocument();
  });
});

describe('toolbar and chip scenarios', () => {
  it('declares toolbar-orders for parity at every width and the 4-chip overflow case implementation only', () => {
    const toolbar = listsParity.find((scenario) => scenario.id === 'toolbar-orders');
    expect(toolbar).toMatchObject({ group: 'lists', parity: true, responsive: true, themes: ['light', 'dark'] });
    // D-41 R2-03: the search box's own focus border is compared too, on the search input (the same selector matches
    // the App. E.7 transcription and the SearchBox).
    expect(toolbar).toMatchObject({ states: ['rest', 'focus-visible'], target: 'input[type="search"]' });
    const chips = listsStates.find((scenario) => scenario.id === 'filterbar-chips-4');
    expect(chips).toMatchObject({ group: 'lists-states', parity: false, responsive: true });
    const chipNodes = (chips?.node.props?.children ?? []) as readonly unknown[];
    expect(chipNodes).toHaveLength(4);
  });

  it('renders the toolbar and the result-bar scenarios through the implementation kit with no axe violations', async () => {
    const ids = ['toolbar-orders', 'filterbar-chips-4', 'resultbar-one'];
    const cases = [...listsParity, ...listsStates].filter((scenario) => ids.includes(scenario.id));
    expect(cases).toHaveLength(ids.length);
    for (const scenario of cases) {
      const view = render(renderNode(kit, scenario.node, scenario.handlers ?? []));
      expect(view.container.textContent, scenario.id).not.toMatch(/Missing component/);
      await expectNoAxeViolations(view.container);
      view.unmount();
    }
  });
});
