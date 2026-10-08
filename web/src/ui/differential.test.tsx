// WEB-02, D-07, D-08, D-12, D-27, D-28: the reconciled design system (src/ui/index.tsx) renders the same DOM as the
// frozen App. D.3 reference (src/ui/__reference__/index.tsx) for every exported component over a prop matrix built
// from the UI-SPEC section 12 seed data. normalizeDom hides only React useId values, the lucide-react default classes,
// the svg xmlns attribute, attribute order and icon inner drawings (research Pattern 3). The one listed structural
// difference is the Sidebar Logout element (D-27). Any other difference is a D-08 stop for an owner ruling, never
// something to normalize away.
import { fireEvent, render, within } from '@testing-library/react';
import { type ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { RouterLink } from '@/app/RouterLink';
import type { CascadeCounts, Order } from '@/lib/csps';
import { normalizeDom } from '@/test/normalizeDom';
import { ICONS } from './icons';
import indexSource from './index.tsx?raw';
import * as Reconciled from './index';

type Ui = typeof Reconciled;

// Loaded through import.meta.glob so the type checker never follows the frozen, unchecked reference (it is excluded
// from tsc and ESLint on purpose; D-07 step 1).
const referenceModules = import.meta.glob<Ui>('./__reference__/index.tsx', { eager: true });
const referenceIconModules = import.meta.glob<{ ICONS: Record<string, unknown> }>('./__reference__/icons.ts', {
  eager: true,
});
const reconciledMarkModules = import.meta.glob<Record<string, unknown>>('./mark.tsx', { eager: true });

function required<T>(value: T | undefined, what: string): T {
  if (value === undefined) {
    throw new Error(`Missing ${what}`);
  }
  return value;
}

const Reference = required(referenceModules['./__reference__/index.tsx'], 'the frozen App. D.3 reference');
const REFERENCE_ICON_NAMES = Object.keys(
  required(referenceIconModules['./__reference__/icons.ts'], 'the frozen App. D.5 reference').ICONS,
) as Reconciled.IconName[];

/* ───────────── UI-SPEC section 12 seed data ───────────── */

const ORDER_0148: Order = {
  number: 'ORD-2026-0148',
  team: 'Brgy. San Roque Ballers',
  customer: 'Juan Dela Cruz',
  contact: '0917 123 4567',
  email: 'juan.dc@gmail.com',
  address: 'Brgy. San Roque, Marikina City',
  status: 'production',
  orderDate: '2026-09-28',
  dueDate: '2026-10-14',
  notes: 'V-neck, black and volt. Captain wants names in caps. Coach polos need embroidered logo.',
  items: [
    { productType: 'Basketball Jersey', description: 'Jersey top', size: 'S–XL', quantity: 15, unitPrice: 650 },
    { productType: 'Basketball Jersey', description: 'Shorts', size: 'S–XL', quantity: 15, unitPrice: 300 },
    { productType: 'Polo Shirt', description: 'Coach polo, embroidered logo', size: 'L', quantity: 2, unitPrice: 550 },
    { productType: 'Long Sleeves', description: 'Warm-up shooting shirt', size: 'S–XL', quantity: 15, unitPrice: 420 },
    { productType: 'Custom Design', description: 'Team logo redraw', size: '—', quantity: 1, unitPrice: 800 },
  ],
  discounts: [{ reason: 'Barangay league discount', type: 'percentage', value: 5 }],
  payments: [
    { date: '2026-09-28', amount: 10000, method: 'GCash', reference: '9012 345 678901', notes: '50% downpayment' },
    { date: '2026-10-03', amount: 2000, method: 'Cash', notes: 'For 2 added coach polos' },
  ],
  expenses: [
    { date: '2026-10-01', category: 'Fabric', description: 'Dri-fit mesh, 45 yds', amount: 3825 },
    { date: '2026-10-02', category: 'Ink & paper', description: 'Sublimation ink + transfer paper', amount: 1640 },
    { date: '2026-10-04', category: 'Outsourcing', description: 'Embroidery — coach polos', amount: 600 },
  ],
  images: [
    { id: 'img-1', name: 'front-mockup.png', number: '23' },
    { id: 'img-2', name: 'back-mockup.png', number: '7' },
    { id: 'img-3', name: 'shorts.png' },
    { id: 'img-4', name: 'reference.jpg' },
  ],
};

const ORDER_0151: Order = {
  number: 'ORD-2026-0151',
  team: 'Tondo Riders MC',
  customer: 'Mark Villanueva',
  status: 'ready',
  orderDate: '2026-09-30',
  dueDate: '2026-10-10',
  items: [{ productType: 'Moto Riding Jersey', quantity: 20, unitPrice: 1150 }],
  discounts: [{ reason: 'Club discount', type: 'fixed', value: 500 }],
  payments: [{ amount: 12000 }, { amount: 10500 }],
  expenses: [{ amount: 7200 }, { amount: 2100 }],
  images: [
    { id: 'img-5', name: 'tondo-front.png', src: '/media/tondo-front.png' },
    { id: 'img-6', name: 'tondo-back.png', src: '/media/tondo-back.png' },
  ],
};

const ORDER_0153: Order = {
  number: 'ORD-2026-0153',
  customer: 'Angelica Santos',
  status: 'mockup',
  overdue: true,
  orderDate: '2026-10-03',
  dueDate: '2026-10-05',
  items: [{ quantity: 12, unitPrice: 780 }],
  payments: [{ amount: 3000 }],
};

const ORDER_0142_LOSS: Order = {
  number: 'ORD-2026-0142',
  team: 'Marikina Moto Club',
  customer: 'Ramon Bautista',
  status: 'completed',
  orderDate: '2026-09-12',
  dueDate: '2026-09-30',
  items: [{ quantity: 30, unitPrice: 690 }],
  discounts: [{ type: 'fixed', value: 1000 }],
  payments: [{ amount: 10000 }, { amount: 9700 }],
  expenses: [{ amount: 22000 }],
  images: [{ id: 'img-7', name: 'moto.png', src: '/media/moto.png' }],
};

const CASCADE_0148: CascadeCounts = { items: 5, payments: 2, discounts: 1, expenses: 3, images: 4 };

const CHART_DATA = [
  { month: 'May', income: 98400, expenses: 61200 },
  { month: 'Jun', income: 132650, expenses: 70350 },
  { month: 'Jul', income: 87300, expenses: 66480 },
  { month: 'Aug', income: 145900, expenses: 74120 },
  { month: 'Sep', income: 112980, expenses: 69900 },
  { month: 'Oct', income: 126450, expenses: 58320 },
];

interface UserRow extends Record<string, unknown> {
  id: string;
  name: string;
  role: string;
  status: string;
  owed: number;
}
const USER_ROWS: UserRow[] = [
  { id: 'u1', name: 'Carmen Reyes', role: 'Manager', status: 'Active', owed: 0 },
  { id: 'u2', name: 'Paolo Garcia', role: 'Admin', status: 'Active', owed: 640 },
  { id: 'u5', name: 'Jomar Santos', role: 'Admin', status: 'Inactive', owed: 1215.6 },
];
const USER_COLUMNS: Reconciled.DataTableColumn<UserRow>[] = [
  { key: 'name', label: 'Name' },
  { key: 'role', label: 'Role', width: 120 },
  { key: 'status', label: 'Status', align: 'center', render: (row) => <strong>{row.status}</strong> },
  { key: 'owed', label: 'Owed', align: 'right', money: true },
];

const CARMEN = { name: 'Carmen Reyes' };
const JOMAR = { name: 'Jomar Santos' };
const noop = (): void => undefined;

/* ───────────── the prop matrix ───────────── */

interface Case {
  readonly name: string;
  readonly render: (ui: Ui) => ReactElement;
  /** Optional interaction applied identically to both renders before comparing. */
  readonly interact?: (container: HTMLElement) => void;
  /** Sidebar cases: the only listed structural difference is the Logout element (D-27). */
  readonly d27?: boolean;
}

const LINK_TARGETS = ['/products', 'https://www.facebook.com/csps', 'mailto:hello@cspstailoring.com', 'tel:+639171234567', '#top'];

const iconCases: Case[] = [
  ...REFERENCE_ICON_NAMES.map((name) => ({ name: `Icon ${name}`, render: (ui: Ui) => <ui.Icon name={name} /> })),
  { name: 'Icon labelled', render: (ui) => <ui.Icon name="star" label="Favourite" size={24} /> },
  { name: 'Icon spinning sm', render: (ui) => <ui.Icon name="loader-circle" size={16} className="csp-spin" /> },
  { name: 'Icon thin stroke', render: (ui) => <ui.Icon name="search" strokeWidth={1.5} size={28} /> },
  { name: 'Icon empty class', render: (ui) => <ui.Icon name="star" className="" size={16} /> },
  { name: 'Icon extra svg props', render: (ui) => <ui.Icon name="info" style={{ color: 'red' }} data-x="1" /> },
];

const CASES: Case[] = [
  { name: 'LinkProvider children', render: (ui) => <ui.LinkProvider component={RouterLink}><span>Kids</span></ui.LinkProvider> },
  ...LINK_TARGETS.map((to) => ({
    name: `UiLink ${to}`,
    render: (ui: Ui) => (
      <ui.UiLink to={to} className="csp-site-link">
        Go
      </ui.UiLink>
    ),
  })),
  { name: 'UiLink aria-current + title', render: (ui) => <ui.UiLink to="/" aria-current="page" title="Home">Home</ui.UiLink> },
  ...iconCases,
  { name: 'Mark default', render: (ui) => <ui.Mark /> },
  { name: 'Mark labelled', render: (ui) => <ui.Mark size={64} label="CSPS" className="x" /> },
  ...(['sm', 'md', 'lg'] as const).flatMap((size) =>
    (['full', 'wordmark', 'mark'] as const).flatMap((variant) =>
      [true, false].map((tagline) => ({
        name: `Logo ${size} ${variant} tagline=${String(tagline)}`,
        render: (ui: Ui) => <ui.Logo size={size} variant={variant} tagline={tagline} />,
      })),
    ),
  ),
  { name: 'Logo default', render: (ui) => <ui.Logo className="csp-site-logo-img" /> },
  { name: 'StitchDivider plain', render: (ui) => <ui.StitchDivider /> },
  { name: 'StitchDivider labelled', render: (ui) => <ui.StitchDivider label="Our process" className="x" /> },
  { name: 'SectionCut default', render: (ui) => <ui.SectionCut>Body</ui.SectionCut> },
  { name: 'SectionCut accent mesh', render: (ui) => <ui.SectionCut tone="accent" mesh top={false} className="x">Body</ui.SectionCut> },
  { name: 'SectionCut no bottom', render: (ui) => <ui.SectionCut bottom={false} /> },
  { name: 'MediaPlaceholder empty', render: (ui) => <ui.MediaPlaceholder /> },
  { name: 'MediaPlaceholder labelled', render: (ui) => <ui.MediaPlaceholder label="Front mockup" number="23" ratio="16 / 10" /> },
  { name: 'MediaPlaceholder number 0', render: (ui) => <ui.MediaPlaceholder number={0} className="x" /> },
  { name: 'MediaPlaceholder empty number', render: (ui) => <ui.MediaPlaceholder number="" label="" /> },
  ...(['primary', 'secondary', 'ghost', 'danger', 'ghost-danger'] as const).map((variant) => ({
    name: `Button ${variant}`,
    render: (ui: Ui) => <ui.Button variant={variant}>Save order</ui.Button>,
  })),
  ...(['sm', 'md', 'lg'] as const).map((size) => ({
    name: `Button ${size} icons`,
    render: (ui: Ui) => (
      <ui.Button size={size} icon="plus" iconRight="arrow-right">
        New order
      </ui.Button>
    ),
  })),
  { name: 'Button loading', render: (ui) => <ui.Button variant="primary" icon="plus" iconRight="arrow-right" loading>Saving</ui.Button> },
  { name: 'Button icon-only', render: (ui) => <ui.Button variant="ghost-danger" icon="trash-2" aria-label="Delete order" /> },
  { name: 'Button block submit disabled', render: (ui) => <ui.Button block type="submit" disabled className="x">Sign in</ui.Button> },
  { name: 'Button children 0 and false', render: (ui) => <ui.Button>{0}</ui.Button> },
  { name: 'Button children false', render: (ui) => <ui.Button icon="x">{false}</ui.Button> },
  { name: 'ButtonLink default', render: (ui) => <ui.ButtonLink to="/contact">Get a Quote</ui.ButtonLink> },
  { name: 'ButtonLink icons', render: (ui) => <ui.ButtonLink to="/products" variant="primary" size="sm" icon="shirt" iconRight="arrow-right" className="x">Shop</ui.ButtonLink> },
  { name: 'ButtonLink external lg', render: (ui) => <ui.ButtonLink to="https://m.me/csps" size="lg" icon="message-circle">Message us</ui.ButtonLink> },
  ...(['neutral', 'accent', 'success', 'warning', 'info', 'mockup', 'danger', 'solid'] as const).map((tone) => ({
    name: `Badge ${tone}`,
    render: (ui: Ui) => <ui.Badge tone={tone}>Label</ui.Badge>,
  })),
  { name: 'Badge dot icon', render: (ui) => <ui.Badge dot icon="lock" className="x">Manager</ui.Badge> },
  ...(['pending', 'mockup', 'production', 'ready', 'completed', 'cancelled'] as const).map((status) => ({
    name: `StatusBadge ${status}`,
    render: (ui: Ui) => <ui.StatusBadge status={status} />,
  })),
  { name: 'StatusBadge default', render: (ui) => <ui.StatusBadge className="x" /> },
  { name: 'Avatar Carmen', render: (ui) => <ui.Avatar name="Carmen Reyes" /> },
  { name: 'Avatar Jomar 48', render: (ui) => <ui.Avatar name="jomar  santos" size={48} className="x" /> },
  { name: 'Avatar empty', render: (ui) => <ui.Avatar /> },
  { name: 'Avatar three words small', render: (ui) => <ui.Avatar name="Ma. Liza Mercado" size={20} /> },
  { name: 'Field label hint', render: (ui) => <ui.Field label="Team name" hint="As printed on the jersey" defaultValue="Tondo Riders MC" /> },
  { name: 'Field error required', render: (ui) => <ui.Field label="Customer" required error="Enter the customer's name." /> },
  { name: 'Field money prefix', render: (ui) => <ui.Field label="Amount" prefix="₱" inputMode="decimal" placeholder="0.00" /> },
  { name: 'Field multiline', render: (ui) => <ui.Field multiline label="Notes" rows={3} defaultValue="V-neck, black and volt." /> },
  { name: 'Field own id no label', render: (ui) => <ui.Field id="order-search" className="x" aria-label="Search" /> },
  { name: 'Field typed', render: (ui) => <ui.Field label="Email" type="email" />, interact: (c) => fireEvent.change(within(c).getByLabelText('Email'), { target: { value: 'carmen.reyes.csp@gmail.com' } }) },
  { name: 'PasswordField default', render: (ui) => <ui.PasswordField /> },
  { name: 'PasswordField strength empty', render: (ui) => <ui.PasswordField showStrength label="New password" /> },
  { name: 'PasswordField strength weak', render: (ui) => <ui.PasswordField showStrength defaultValue="abc" /> },
  { name: 'PasswordField strength strong controlled', render: (ui) => <ui.PasswordField showStrength value="Str0ng!Passw0rd" onChange={noop} /> },
  { name: 'PasswordField error hint', render: (ui) => <ui.PasswordField error="Wrong password." hint="At least 8 characters" /> },
  { name: 'PasswordField shown', render: (ui) => <ui.PasswordField defaultValue="secret-1" />, interact: (c) => fireEvent.click(within(c).getByRole('button', { name: 'Show password' })) },
  { name: 'PasswordField typed', render: (ui) => <ui.PasswordField showStrength />, interact: (c) => fireEvent.change(within(c).getByLabelText('Password'), { target: { value: 'Abcdefg1!' } }) },
  { name: 'Select strings', render: (ui) => <ui.Select label="Method" options={['Cash', 'GCash', 'Maya', 'Bank Transfer']} defaultValue="GCash" /> },
  { name: 'Select objects placeholder', render: (ui) => <ui.Select label="Status" placeholder="Any status" options={[{ value: 'pending', label: 'Pending' }, { value: 'ready', label: 'Ready' }]} /> },
  { name: 'Select error', render: (ui) => <ui.Select label="Category" options={['Rent']} error="Pick a category." className="x" /> },
  { name: 'Select hint no label', render: (ui) => <ui.Select options={['A', 'B']} hint="Optional" aria-label="Pick" /> },
  { name: 'SegmentedControl icons', render: (ui) => <ui.SegmentedControl label="View" options={[{ value: 'grid', label: 'Grid', icon: 'layout-grid' }, { value: 'list', label: 'List', icon: 'list' }]} /> },
  { name: 'SegmentedControl labels value', render: (ui) => <ui.SegmentedControl value="b" onChange={noop} options={[{ value: 'a', label: 'Week' }, { value: 'b', label: 'Month' }]} /> },
  { name: 'SegmentedControl showLabel', render: (ui) => <ui.SegmentedControl options={[{ value: 'grid', label: 'Grid', icon: 'layout-grid', showLabel: true }]} /> },
  { name: 'SegmentedControl clicked', render: (ui) => <ui.SegmentedControl options={[{ value: 'a', label: 'Week' }, { value: 'b', label: 'Month' }]} />, interact: (c) => fireEvent.click(within(c).getByRole('radio', { name: 'Month' })) },
  { name: 'Tabs counts', render: (ui) => <ui.Tabs items={[{ id: 'items', label: 'Items', count: 5 }, { id: 'payments', label: 'Payments', count: 2 }, { id: 'images', label: 'Images', count: 0 }]} /> },
  { name: 'Tabs value', render: (ui) => <ui.Tabs value="payments" onChange={noop} items={[{ id: 'items', label: 'Items' }, { id: 'payments', label: 'Payments' }]} /> },
  { name: 'Tabs clicked', render: (ui) => <ui.Tabs items={[{ id: 'items', label: 'Items' }, { id: 'payments', label: 'Payments' }]} />, interact: (c) => fireEvent.click(within(c).getByRole('tab', { name: 'Payments' })) },
  { name: 'ImageUploader empty', render: (ui) => <ui.ImageUploader /> },
  { name: 'ImageUploader default images', render: (ui) => <ui.ImageUploader defaultImages={ORDER_0148.images} max={6} /> },
  { name: 'ImageUploader controlled src', render: (ui) => <ui.ImageUploader images={ORDER_0151.images} onChange={noop} /> },
  { name: 'ImageUploader make cover', render: (ui) => <ui.ImageUploader defaultImages={ORDER_0148.images} />, interact: (c) => fireEvent.click(within(c).getAllByRole('button', { name: 'Make cover image' })[1] ?? c) },
  { name: 'ImageUploader remove', render: (ui) => <ui.ImageUploader defaultImages={ORDER_0148.images} />, interact: (c) => fireEvent.click(within(c).getByRole('button', { name: 'Remove shorts.png' })) },
  { name: 'Money md', render: (ui) => <ui.Money amount={22450} /> },
  { name: 'Money lg success', render: (ui) => <ui.Money amount={9327.5} size="lg" tone="success" /> },
  { name: 'Money sm negative danger', render: (ui) => <ui.Money amount={-1122.5} size="sm" tone="danger" className="x" /> },
  { name: 'Money muted zero', render: (ui) => <ui.Money amount={0} tone="muted" /> },
  { name: 'KpiCard money delta up', render: (ui) => <ui.KpiCard label="Collected Oct" value={126450} icon="wallet" delta={12} deltaLabel="vs Sep" /> },
  { name: 'KpiCard money delta down', render: (ui) => <ui.KpiCard label="Expenses Oct" value={38226.95} icon="receipt" delta={-4} hint="Company + orders" /> },
  { name: 'KpiCard count hint', render: (ui) => <ui.KpiCard label="Active orders" value={18} money={false} hint="4 due this week" /> },
  { name: 'KpiCard text value', render: (ui) => <ui.KpiCard label="Top category" value="Rent" /> },
  { name: 'KpiCard loading', render: (ui) => <ui.KpiCard label="Receivables" value={84260} loading delta={3} /> },
  { name: 'OrderTotals panel 0148', render: (ui) => <ui.OrderTotals order={ORDER_0148} /> },
  { name: 'OrderTotals card 0148', render: (ui) => <ui.OrderTotals order={ORDER_0148} variant="card" /> },
  { name: 'OrderTotals panel 0151 paid', render: (ui) => <ui.OrderTotals order={ORDER_0151} /> },
  { name: 'OrderTotals card 0151 paid', render: (ui) => <ui.OrderTotals order={ORDER_0151} variant="card" /> },
  { name: 'OrderTotals loss', render: (ui) => <ui.OrderTotals order={ORDER_0142_LOSS} /> },
  { name: 'OrderTotals empty', render: (ui) => <ui.OrderTotals /> },
  { name: 'OrderCard 0148', render: (ui) => <ui.OrderCard order={ORDER_0148} onView={noop} onEdit={noop} onDelete={noop} /> },
  { name: 'OrderCard 0151', render: (ui) => <ui.OrderCard order={ORDER_0151} /> },
  { name: 'OrderCard 0153 overdue', render: (ui) => <ui.OrderCard order={ORDER_0153} /> },
  { name: 'OrderCard 0142 one image', render: (ui) => <ui.OrderCard order={ORDER_0142_LOSS} /> },
  { name: 'DataTable rows', render: (ui) => <ui.DataTable columns={USER_COLUMNS} rows={USER_ROWS} rowKey="id" caption="Staff" /> },
  { name: 'DataTable rows no key', render: (ui) => <ui.DataTable columns={USER_COLUMNS} rows={USER_ROWS} /> },
  { name: 'DataTable loading', render: (ui) => <ui.DataTable columns={USER_COLUMNS} rows={[]} loading /> },
  { name: 'DataTable error', render: (ui) => <ui.DataTable columns={USER_COLUMNS} rows={USER_ROWS} error="Could not load users." /> },
  { name: 'DataTable empty default', render: (ui) => <ui.DataTable columns={USER_COLUMNS} rows={[]} /> },
  { name: 'DataTable empty custom', render: (ui) => <ui.DataTable columns={USER_COLUMNS} rows={[]} empty={<em>No staff yet.</em>} /> },
  { name: 'IncomeExpenseChart six months', render: (ui) => <ui.IncomeExpenseChart data={CHART_DATA} /> },
  { name: 'IncomeExpenseChart empty', render: (ui) => <ui.IncomeExpenseChart data={[]} height={180} /> },
  { name: 'IncomeExpenseChart small values', render: (ui) => <ui.IncomeExpenseChart data={[{ month: 'Jan', income: 0, expenses: 640 }, { month: 'Feb', income: 999, expenses: 0 }]} /> },
  { name: 'IncomeExpenseChart hover', render: (ui) => <ui.IncomeExpenseChart data={CHART_DATA} />, interact: (c) => fireEvent.mouseEnter(c.querySelectorAll('svg > g')[4] ?? c) },
  { name: 'IncomeExpenseChart hover leave', render: (ui) => <ui.IncomeExpenseChart data={CHART_DATA} />, interact: (c) => { fireEvent.mouseEnter(c.querySelectorAll('svg > g')[4] ?? c); fireEvent.mouseLeave(c.querySelector('svg') ?? c); } },
  { name: 'Modal center', render: (ui) => <ui.Modal title="Add payment" description="Record money received." onClose={noop} footer={<button type="button">Save</button>}><p>Body</p></ui.Modal> },
  { name: 'Modal slideover', render: (ui) => <ui.Modal title="Add user" variant="slideover" onClose={noop}><p>Body</p></ui.Modal> },
  { name: 'Modal inline no close', render: (ui) => <ui.Modal title="Delete order" inline><p>Body</p></ui.Modal> },
  { name: 'Modal closed', render: (ui) => <ui.Modal open={false} title="Hidden" /> },
  { name: 'ConfirmDialog default', render: (ui) => <ui.ConfirmDialog onCancel={noop} onConfirm={noop} /> },
  { name: 'ConfirmDialog cascade type-to-confirm', render: (ui) => <ui.ConfirmDialog title="Delete ORD-2026-0148?" message="The order and everything recorded on it will be removed." counts={CASCADE_0148} confirmText="ORD-2026-0148" inline onCancel={noop} /> },
  { name: 'ConfirmDialog zero counts', render: (ui) => <ui.ConfirmDialog counts={{}} confirmLabel="Remove" /> },
  { name: 'ConfirmDialog partial counts', render: (ui) => <ui.ConfirmDialog counts={{ items: 1, images: 0, payments: 2 }} /> },
  { name: 'ConfirmDialog loading', render: (ui) => <ui.ConfirmDialog loading onCancel={noop} /> },
  { name: 'ConfirmDialog typed match', render: (ui) => <ui.ConfirmDialog confirmText="ORD-2026-0151" />, interact: (c) => fireEvent.change(within(c).getByRole('textbox'), { target: { value: ' ORD-2026-0151 ' } }) },
  ...(['success', 'danger', 'info', 'warning'] as const).map((tone) => ({
    name: `Toast ${tone}`,
    render: (ui: Ui) => <ui.Toast tone={tone} title="Order saved" message="ORD-2026-0148 was updated." onClose={noop} />,
  })),
  { name: 'Toast default action', render: (ui) => <ui.Toast title="Copied" action={<button type="button">Undo</button>} /> },
  { name: 'SiteHeader default', render: (ui) => <ui.SiteHeader onQuote={noop} /> },
  { name: 'SiteHeader products', render: (ui) => <ui.SiteHeader active="Products" /> },
  { name: 'SiteHeader custom links', render: (ui) => <ui.SiteHeader links={[{ label: 'Home', to: '/' }, { label: 'FAQ', to: '#faq' }]} active="FAQ" /> },
  { name: 'SiteHeader drawer open', render: (ui) => <ui.SiteHeader active="Gallery" />, interact: (c) => fireEvent.click(within(c).getByRole('button', { name: 'Menu' })) },
  { name: 'SiteHeader drawer link closes', render: (ui) => <ui.SiteHeader />, interact: (c) => { fireEvent.click(within(c).getByRole('button', { name: 'Menu' })); fireEvent.click(within(c).getAllByRole('link', { name: 'Contact' })[1] ?? c); } },
  { name: 'Sidebar default', render: (ui) => <ui.Sidebar />, d27: true },
  { name: 'Sidebar manager users', render: (ui) => <ui.Sidebar role="manager" active="users" user={CARMEN} onLogout={noop} onNavigate={noop} />, d27: true },
  { name: 'Sidebar admin orders', render: (ui) => <ui.Sidebar role="admin" active="orders" user={JOMAR} />, d27: true },
  { name: 'Sidebar collapsed', render: (ui) => <ui.Sidebar role="manager" collapsed active="expenses" user={CARMEN} />, d27: true },
  { name: 'Sidebar default collapsed', render: (ui) => <ui.Sidebar defaultCollapsed active="profile" />, d27: true },
  { name: 'Sidebar toggled', render: (ui) => <ui.Sidebar role="manager" user={CARMEN} />, interact: (c) => fireEvent.click(within(c).getByRole('button', { name: 'Collapse sidebar' })), d27: true },
  { name: 'Sidebar logout clicked', render: (ui) => <ui.Sidebar onLogout={noop} />, interact: (c) => fireEvent.click(within(c).getByText('Logout')), d27: true },
  { name: 'Topbar default', render: (ui) => <ui.Topbar /> },
  { name: 'Topbar admin light toggle', render: (ui) => <ui.Topbar user={JOMAR} role="admin" theme="light" onToggleTheme={noop} onMenu={noop} onSearch={noop} /> },
  { name: 'Topbar dark toggle', render: (ui) => <ui.Topbar theme="dark" onToggleTheme={noop} placeholder="Search…" /> },
  { name: 'Topbar slash focuses search', render: (ui) => <ui.Topbar />, interact: (c) => { fireEvent.keyDown(c, { key: '/' }); fireEvent.keyDown(within(c).getByRole('searchbox'), { key: 'Enter' }); } },
  { name: 'CategoryCard placeholder', render: (ui) => <ui.CategoryCard title="Basketball Jerseys" description="Full sublimation, names and numbers." number="23" /> },
  { name: 'CategoryCard image href', render: (ui) => <ui.CategoryCard title="Moto Jerseys" description="Long sleeves for riding clubs." image="/media/moto.png" href="/products#moto" /> },
  { name: 'ProcessSteps', render: (ui) => <ui.ProcessSteps steps={[{ title: 'Message us', description: 'Send your design idea.', icon: 'message-circle' }, { title: 'Approve the mockup', description: 'We send a free mockup.', icon: 'palette' }, { title: 'Pick up', description: 'Ready in 7–10 days.' }]} /> },
  { name: 'ProcessSteps empty', render: (ui) => <ui.ProcessSteps steps={[]} /> },
  { name: 'TestimonialCard five', render: (ui) => <ui.TestimonialCard quote="Our jerseys came out perfect." name="Mark Villanueva" team="Tondo Riders MC" /> },
  { name: 'TestimonialCard three', render: (ui) => <ui.TestimonialCard quote="Fast and friendly." name="Kristine Mendoza" team="Lady Spikers QC" rating={3} /> },
  { name: 'EmptyState default', render: (ui) => <ui.EmptyState title="No orders yet" /> },
  { name: 'EmptyState full', render: (ui) => <ui.EmptyState icon="search" title="No matches" message="Try another search." action={<button type="button">Clear filters</button>} /> },
  { name: 'Skeleton default', render: (ui) => <ui.Skeleton /> },
  { name: 'Skeleton sized', render: (ui) => <ui.Skeleton width={120} height="2rem" radius={999} className="x" /> },
  { name: 'ToastProvider empty', render: (ui) => <ui.ToastProvider><p>App</p></ui.ToastProvider> },
  { name: 'ToastProvider four pushes', render: (ui) => <ui.ToastProvider><ToastPusher ui={ui} /></ui.ToastProvider>, interact: (c) => { for (let i = 0; i < 4; i += 1) fireEvent.click(within(c).getByRole('button', { name: 'Push' })); } },
  { name: 'ToastProvider push then dismiss', render: (ui) => <ui.ToastProvider><ToastPusher ui={ui} /></ui.ToastProvider>, interact: (c) => { fireEvent.click(within(c).getByRole('button', { name: 'Push' })); fireEvent.click(within(c).getByRole('button', { name: 'Dismiss' })); } },
];

let toastCount = 0;
function ToastPusher({ ui }: { ui: Ui }) {
  const push = ui.useToast();
  return (
    <button
      type="button"
      onClick={() => {
        toastCount += 1;
        push({ tone: toastCount % 2 === 0 ? 'danger' : 'success', title: 'Saved', message: 'Toast' });
      }}
    >
      Push
    </button>
  );
}

/* ───────────── rendering and the D-27 allowance ───────────── */

function renderReference(element: ReactElement): HTMLElement {
  return render(
    <MemoryRouter>
      <Reference.LinkProvider component={RouterLink}>{element}</Reference.LinkProvider>
    </MemoryRouter>,
  ).container;
}

function renderReconciled(element: ReactElement): HTMLElement {
  return render(<MemoryRouter>{element}</MemoryRouter>).container;
}

/** D-27: the reference Logout `<a href="#" class="csp-nav">` becomes `<button type="button" class="csp-nav">`. */
function referenceLogout(container: HTMLElement): Element | null {
  return container.querySelector('.csp-sidebar-foot > a.csp-nav[href="#"]');
}
function reconciledLogout(container: HTMLElement): Element | null {
  return container.querySelector('.csp-sidebar-foot > button.csp-nav[type="button"]');
}

/** Rewrites the reference Logout anchor as the D-27 button, keeping every other attribute and child. */
function applyD27(container: HTMLElement): void {
  const anchor = referenceLogout(container);
  if (anchor === null) {
    throw new Error('D-27: the reference Sidebar has no Logout anchor');
  }
  const button = container.ownerDocument.createElement('button');
  button.setAttribute('type', 'button');
  for (const attribute of Array.from(anchor.attributes)) {
    if (attribute.name !== 'href') {
      button.setAttribute(attribute.name, attribute.value);
    }
  }
  while (anchor.firstChild !== null) {
    button.appendChild(anchor.firstChild);
  }
  anchor.replaceWith(button);
}

function renderPair(testCase: Case): { reference: HTMLElement; reconciled: HTMLElement } {
  const reference = renderReference(testCase.render(Reference));
  const reconciled = renderReconciled(testCase.render(Reconciled));
  if (testCase.interact !== undefined) {
    testCase.interact(reference);
    testCase.interact(reconciled);
  }
  return { reference, reconciled };
}

describe('reconciled design system vs frozen App. D.3 (WEB-02, D-07)', () => {
  it(`covers every export and at least 120 prop-matrix renders (${String(CASES.length)} cases)`, () => {
    expect(CASES.length).toBeGreaterThanOrEqual(120);
    expect(new Set(CASES.map((c) => c.name)).size).toBe(CASES.length);
    const exported = [...indexSource.matchAll(/^export function (\w+)/gm)].map((m) => m[1]);
    const covered = new Set(CASES.map((c) => c.name.split(' ')[0]));
    expect(exported.filter((name) => name === undefined || !covered.has(name))).toEqual([]);
  });

  it('src/ui/index.tsx still exports 37 functions', () => {
    expect(indexSource.split('\n').filter((line) => line.startsWith('export function')).length).toBe(37);
  });

  it('keeps the exported constants and the toast hook', () => {
    for (const ui of [Reference, Reconciled]) {
      expect(Object.keys(ui.STATUS_TONE)).toHaveLength(6);
      expect(ui.PAYMENT_TONE.GCash).toBe('info');
      expect(ui.EXPENSE_TONE.Rent).toBe('accent');
      expect(ui.SITE_LINKS.map((l) => l.to)).toEqual(['/', '/products', '/gallery', '/contact']);
      expect(ui.ADMIN_NAV.map((n) => n.id)).toEqual(['dashboard', 'orders', 'expenses', 'users', 'profile']);
      expect(typeof ui.useToast).toBe('function');
    }
    expect(Reconciled.STATUS_TONE).toEqual(Reference.STATUS_TONE);
    expect(Reconciled.PAYMENT_TONE).toEqual(Reference.PAYMENT_TONE);
    expect(Reconciled.EXPENSE_TONE).toEqual(Reference.EXPENSE_TONE);
    expect(Reconciled.ADMIN_NAV).toEqual(Reference.ADMIN_NAV);
  });

  it.each(CASES.map((c) => [c.name, c] as const))('%s renders the same normalized DOM', (_name, testCase) => {
    const { reference, reconciled } = renderPair(testCase);
    if (testCase.d27 === true) {
      applyD27(reference);
    }
    expect(normalizeDom(reconciled.innerHTML)).toBe(normalizeDom(reference.innerHTML));
  });
});

describe('the one listed structural difference: Sidebar Logout (D-27)', () => {
  const sidebarCases = CASES.filter((c) => c.d27 === true);

  it('applies only to Sidebar cases', () => {
    expect(sidebarCases.length).toBeGreaterThanOrEqual(5);
    expect(sidebarCases.every((c) => c.name.startsWith('Sidebar '))).toBe(true);
    expect(CASES.filter((c) => c.name.startsWith('Sidebar ')).every((c) => c.d27 === true)).toBe(true);
  });

  it.each(sidebarCases.map((c) => [c.name, c] as const))(
    '%s: anchor in the reference, button in the reconciled, same classes, title and text',
    (_name, testCase) => {
      const { reference, reconciled } = renderPair(testCase);
      const anchor = referenceLogout(reference);
      const button = reconciledLogout(reconciled);
      expect(anchor, 'reference Logout anchor').not.toBeNull();
      expect(button, 'reconciled Logout button').not.toBeNull();
      expect(reconciled.querySelector('.csp-sidebar-foot > a')).toBeNull();
      expect(button?.getAttribute('class')).toBe(anchor?.getAttribute('class'));
      expect(button?.getAttribute('title')).toBe(anchor?.getAttribute('title'));
      expect(button?.textContent).toBe('Logout');
      expect(anchor?.textContent).toBe('Logout');
      expect(normalizeDom(reconciled.innerHTML)).not.toBe(normalizeDom(reference.innerHTML));
    },
  );
});

describe('icons and mark (D-10, D-12, WEB-02)', () => {
  it('the reconciled icon map has the 56 App. D.5 names and nothing else', () => {
    expect(REFERENCE_ICON_NAMES).toHaveLength(56);
    expect(Object.keys(ICONS).sort()).toEqual([...REFERENCE_ICON_NAMES].sort());
  });

  it('each icon map entry is a lucide-react component (D-10), not node data', () => {
    const notComponents = Object.entries(ICONS)
      .filter(([, value]) => Array.isArray(value) || typeof value !== 'object' || !('$$typeof' in value))
      .map(([name]) => name);
    expect(notComponents).toEqual([]);
  });

  it('Icon draws the lucide-react 1.52.0 shape (menu bars at y = 5 / 12 / 19), not the 0.460 node data', () => {
    const svg = renderReconciled(<Reconciled.Icon name="menu" />).querySelector('svg.csp-icon');
    expect(svg?.innerHTML).toContain('M4 5h16');
    expect(svg?.innerHTML).toContain('M4 19h16');
  });

  it('mark.tsx exports MarkSvg and the Mark renders without raw HTML injection', () => {
    expect(Object.keys(reconciledMarkModules), 'src/ui/mark.tsx').toEqual(['./mark.tsx']);
    expect(typeof reconciledMarkModules['./mark.tsx']?.MarkSvg).toBe('function');
    expect(indexSource).not.toContain('dangerouslySetInnerHTML');
    expect(indexSource).not.toContain('MARK_SVG');
  });

  it('every reconciled change from the verbatim copy is marked SPEC-DEVIATION (at least 10 markers)', () => {
    expect(indexSource.match(/SPEC-DEVIATION/g)?.length ?? 0).toBeGreaterThanOrEqual(10);
  });
});
