// Reference side of the list toolbar (plan 02-30; test only, never shipped): a JSX transcription of the App. E.7 Orders
// toolbar, `div.s-toolbar[role=search]` with the search column (its inline styles kept, the `.csp-label` and the
// `.s-search-box` with the search icon and a `type="search"` input), the frozen App. D.3 Selects for Status, Order date,
// Product type and Sort by at their App. E.7 values, and `.s-toolbar-end` with the frozen grid/table SegmentedControl.
// The options are App. E.7's (PRODUCT_TYPES from App. D.1). The implementation side renders the real FilterBar,
// SearchBox, Select and SegmentedControl (web/src/dev/previews/Toolbar.tsx). App. E.7's `id="ord-q"` is kept; the
// implementation's ids differ, and attributes are not compared.
// The frozen components come from the extracted spec module, loaded the way kit.ts loads it (import.meta.glob, so the
// frozen code is never type-checked).
import type { ComponentType } from 'react';

type ModuleExports = Readonly<Record<string, unknown>>;

const spec = Object.values(import.meta.glob<ModuleExports>('../../.reference-src/ui/index.tsx', { eager: true }))[0];

function frozen(name: string): unknown {
  const value = spec?.[name];
  if (value === undefined) {
    throw new Error(`The frozen spec has no ${name}. Run node visual/reference/extract-spec.mjs.`);
  }
  return value;
}

interface Option {
  value: string;
  label: string;
  icon?: string;
}

const Icon = frozen('Icon') as ComponentType<{ name: string; size?: number }>;
const Select = frozen('Select') as ComponentType<{
  label: string;
  options: readonly (string | Option)[];
  defaultValue?: string;
  placeholder?: string;
}>;
const SegmentedControl = frozen('SegmentedControl') as ComponentType<{
  label: string;
  value: string;
  options: readonly Option[];
}>;
const PRODUCT_TYPES = frozen('PRODUCT_TYPES') as readonly string[];

const opt = (pairs: readonly (readonly [string, string])[]): Option[] =>
  pairs.map(([value, label]) => ({ value, label }));

const STATUS = opt([
  ['active', 'Active + recent'],
  ['all', 'All statuses'],
  ['pending', 'Pending'],
  ['mockup', 'Mockup'],
  ['production', 'In Production'],
  ['ready', 'Ready'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
]);
const DATES = opt([
  ['30', 'Last 30 days'],
  ['90', 'Last 90 days'],
  ['month', 'This month'],
  ['custom', 'Custom range…'],
]);
const SORTS = opt([
  ['due', 'Due date (soonest)'],
  ['new', 'Newest first'],
  ['balance', 'Balance (highest)'],
  ['total', 'Total (highest)'],
]);
const VIEWS: Option[] = [
  { value: 'grid', label: 'Grid view', icon: 'layout-grid' },
  { value: 'table', label: 'Table view', icon: 'list' },
];

export function Toolbar() {
  return (
    <div className="s-toolbar" role="search">
      <div className="s-search" style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 260px' }}>
        <label
          className="csp-label"
          htmlFor="ord-q"
          style={{ fontSize: 12, lineHeight: '16px', color: 'var(--ink-muted)' }}
        >
          Search
        </label>
        <div className="s-search-box">
          <Icon name="search" size={18} />
          <input id="ord-q" type="search" placeholder="Order no., customer or team" />
        </div>
      </div>
      <Select label="Status" options={STATUS} defaultValue="active" />
      <Select label="Order date" options={DATES} defaultValue="90" />
      <Select label="Product type" options={PRODUCT_TYPES} placeholder="All products" />
      <Select label="Sort by" options={SORTS} defaultValue="due" />
      <div className="s-toolbar-end">
        <SegmentedControl label="View" value="grid" options={VIEWS} />
      </div>
    </div>
  );
}
