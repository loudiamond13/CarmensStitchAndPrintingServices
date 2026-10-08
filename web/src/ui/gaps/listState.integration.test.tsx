// WEB-10 end to end (02-UI-SPEC SPEC-GAP "Pagination", "SearchBox", "FilterBar"): the list primitives wired to a list
// hook from createListParams under the nuqs testing adapter with the app's options. A page change is one push; a
// page-size change, a chip clear and a search are one replace each, and each resets the page. Search writes the URL
// after 300 ms of quiet, or at once on Enter.
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { withNuqsTestingAdapter, type OnUrlUpdateFunction, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createListParams } from '@/lib/url-state/createListParams';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { literalParser, PAGE_SIZES, pageSizeParser, parseAsPage, parseAsSearch } from '@/lib/url-state/parsers';
import { FilterBar, FilterChip, ResultBar } from './FilterBar';
import { Pagination } from './Pagination';
import { SearchBox } from './SearchBox';

const STATUS_LABELS = { active: 'Active + recent', all: 'All statuses', ready: 'Ready' } as const;

const useOrdersListParams = createListParams({
  page: parseAsPage,
  pageSize: pageSizeParser,
  search: parseAsSearch,
  status: literalParser(['active', 'all', 'ready'], 'active'),
});

/** A list screen built the plan 08 way: it reads and writes its state only through the list hook. */
function OrdersList() {
  const [params, set] = useOrdersListParams();
  return (
    <>
      <FilterBar>
        <SearchBox
          value={params.search ?? ''}
          placeholder="Order no., customer or team"
          onChange={(value) => {
            set.setSearch(value);
          }}
          onSubmit={(value) => {
            set.setSearch(value, { immediate: true });
          }}
        />
      </FilterBar>
      <ResultBar count={12} thing="order" things="orders" sortLabel="due date">
        {params.status !== 'active' && (
          <FilterChip
            label="Status"
            value={STATUS_LABELS[params.status]}
            onClear={() => {
              set.setFilter('status', null);
            }}
          />
        )}
      </ResultBar>
      <h2 id="orders-results" tabIndex={-1}>
        Orders
      </h2>
      <Pagination
        page={params.page}
        pageCount={5}
        onPageChange={set.setPage}
        focusTargetId="orders-results"
        pageSize={params.pageSize}
        onPageSizeChange={(size) => {
          set.setPageSize(PAGE_SIZES.find((allowed) => allowed === size) ?? null);
        }}
      />
    </>
  );
}

function renderList(searchParams = '') {
  const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
  const Wrapper = withNuqsTestingAdapter({
    searchParams,
    onUrlUpdate,
    hasMemory: true,
    defaultOptions: URL_STATE_DEFAULTS,
    processUrlSearchParams: orderSearchParams,
  });
  render(<OrdersList />, { wrapper: Wrapper });
  return onUrlUpdate;
}

function updates(onUrlUpdate: ReturnType<typeof vi.fn<OnUrlUpdateFunction>>): { history: string; query: string }[] {
  return onUrlUpdate.mock.calls.map(([event]: [UrlUpdateEvent]) => ({
    history: event.options.history,
    query: event.queryString,
  }));
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('list primitives on the shared list hook (WEB-10)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('Next records one push with page=2 and moves focus to the results heading', async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    const onUrlUpdate = renderList();
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await advance(50);
    expect(updates(onUrlUpdate)).toEqual([{ history: 'push', query: '?page=2' }]);
    expect(screen.getByText('Page', { exact: false }).textContent).toBe('Page 2 of 5');
    expect(screen.getByRole('heading', { name: 'Orders' })).toHaveFocus();
  });

  it('Rows per page 50 from page 3 records one replace with size=50 and no page', async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    const onUrlUpdate = renderList('?page=3');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Rows per page' }), '50');
    await advance(50);
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?size=50' }]);
    expect(screen.getByRole('combobox', { name: 'Rows per page' })).toHaveValue('50');
  });

  it('clearing the status chip records one replace without status and page', async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    const onUrlUpdate = renderList('?page=3&status=ready');
    expect(screen.getByText('Status: Ready')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear status filter' }));
    await advance(50);
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
    expect(screen.queryByText('Status: Ready')).toBeNull();
  });

  it('shows no chip for the default status', () => {
    renderList('');
    expect(document.querySelector('.s-filter-chip')).toBeNull();
  });

  it('typing "jersey" records one replace only after 300 ms of quiet, resetting the page', async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    const onUrlUpdate = renderList('?page=2');
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'jersey');
    await advance(250);
    expect(onUrlUpdate).not.toHaveBeenCalled();
    await advance(100);
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?q=jersey' }]);
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('jersey');
  });

  it('pressing Enter writes the search at once', async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    const onUrlUpdate = renderList('');
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'jersey{Enter}');
    await advance(10);
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?q=jersey' }]);
    await advance(500);
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?q=jersey' }]);
  });
});
