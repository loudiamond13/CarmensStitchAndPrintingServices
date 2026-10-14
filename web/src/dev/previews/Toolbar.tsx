// Dev-only scenario wrapper (plan 02-30; never shipped, D-20): the App. E.7 Orders toolbar as the Orders screen will
// compose it, with the real FilterBar, SearchBox, Select and SegmentedControl at the App. E.7 values (Status "Active +
// recent", Order date "Last 90 days", Product type "All products", Sort by "Due date (soonest)", Grid view). The
// controls are held at those values and every change is a no-op here. The reference side transcribes App. E.7's
// toolbar (web/visual/reference/fragments/Toolbar.tsx).
import { PRODUCT_TYPES } from '@/lib/csps';
import { SegmentedControl, type SegmentOption } from '@/ui/choice';
import { Select, type SelectOption } from '@/ui/forms';
import { FilterBar, SearchBox } from '@/ui/lists';

const STATUS: readonly SelectOption[] = [
  { value: 'active', label: 'Active + recent' },
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'mockup', label: 'Mockup' },
  { value: 'production', label: 'In Production' },
  { value: 'ready', label: 'Ready' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const DATES: readonly SelectOption[] = [
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'month', label: 'This month' },
  { value: 'custom', label: 'Custom range…' },
];

const SORTS: readonly SelectOption[] = [
  { value: 'due', label: 'Due date (soonest)' },
  { value: 'new', label: 'Newest first' },
  { value: 'balance', label: 'Balance (highest)' },
  { value: 'total', label: 'Total (highest)' },
];

const VIEWS: readonly SegmentOption<'grid' | 'table'>[] = [
  { value: 'grid', label: 'Grid view', icon: 'layout-grid' },
  { value: 'table', label: 'Table view', icon: 'list' },
];

function noop(): void {
  // Scenario controls do nothing.
}

export function Toolbar() {
  return (
    <FilterBar end={<SegmentedControl label="View" value="grid" onChange={noop} options={VIEWS} />}>
      <SearchBox value={null} placeholder="Order no., customer or team" onSearch={noop} />
      <Select label="Status" options={STATUS} value="active" onChange={noop} />
      <Select label="Order date" options={DATES} value="90" onChange={noop} />
      <Select label="Product type" options={PRODUCT_TYPES} placeholder="All products" value="" onChange={noop} />
      <Select label="Sort by" options={SORTS} value="due" onChange={noop} />
    </FilterBar>
  );
}
