// The Phase 10 demos of the Component Showcase (UI-SPEC Component Inventory "Component Showcase additions" and "Visual Review"; plan 10-21),
// in the "Dashboard and staff money" section: the dashboard cards, the money strip, the ledger, All Staff, the Transfers table, the
// Transfer and Hand Over windows and the two transfer dialogs, on made-up people and figures (spec 12.1, 12.4). The pieces are the real parts
// fed plain values: nothing here reads or writes a record. The static cases press nothing (a link is not followed and the strip's plain Transfer button
// opens nothing); the windows and dialogs are local-state demos whose confirm only closes them, or a refusal made up here.
import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type MouseEvent, type ReactNode } from 'react';
import { Button } from '@/components';
import { HttpError } from '@/core/api/errors';
import { createQueryClient } from '@/lib/query/queryClient';
import { DashboardKpiRow } from '@/modules/admin/components/DashboardKpiRow';
import { DeleteTransferView } from '@/modules/admin/components/DeleteTransferDialog';
import { dashboardRowClasses } from '@/modules/admin/components/dashboard.recipe';
import { IncomeExpenseCardView, toChartData } from '@/modules/admin/components/IncomeExpenseCard';
import { LedgerTable } from '@/modules/admin/components/LedgerTable';
import { MoneyOnHandCard } from '@/modules/admin/components/MoneyOnHandCard';
import { MoneyStrip } from '@/modules/admin/components/MoneyStrip';
import { OrdersByStatusCard } from '@/modules/admin/components/OrdersByStatusCard';
import { RecentOrdersCard } from '@/modules/admin/components/RecentOrdersCard';
import { RemoveTransferView } from '@/modules/admin/components/RemoveTransferDialog';
import { StaffBalancesTable } from '@/modules/admin/components/StaffBalancesTable';
import { DemoCase } from '@/modules/admin/components/showcase/Phase5Demos';
import {
  moneyCaseColumnClasses,
  phoneRowWidthClasses,
  orderTotalsGridClasses,
  staffStackClasses,
  stillClasses,
} from '@/modules/admin/components/showcase/showcase.recipe';
import { SHOWCASE_COPY } from '@/modules/admin/components/showcase/showcaseCopy';
import { transferGate } from '@/modules/admin/components/TransferButton';
import { TransferForm } from '@/modules/admin/components/TransferModal';
import { TransfersTable } from '@/modules/admin/components/TransfersTable';
import type { DashboardCardQuery } from '@/modules/admin/hooks/useDashboardSummaryQuery';
import type { MyMoneyCardQuery } from '@/modules/admin/hooks/useMyMoneyQuery';
import type { StaffBalancesTableQuery } from '@/modules/admin/hooks/useStaffBalancesQuery';
import { MONEY_COPY } from '@/modules/admin/moneyCopy';
import type { DashboardChartMonthFigures, DashboardSummaryResponse } from '@/modules/admin/services/dashboardService';
import {
  parseLedgerPage,
  parseStaffBalances,
  parseTransferPage,
  toTransferTarget,
  type LedgerEntryResponse,
  type TransferPerson,
  type TransferSavedResponse,
} from '@/modules/admin/services/moneyService';
import type { OrderListEntry } from '@/modules/admin/services/ordersService';
import { formatPeso } from '@/utils/csps';

const DEMO = SHOWCASE_COPY.dashboard;
const TRANSFER = MONEY_COPY.transfer;
const HANDOVER = MONEY_COPY.handover;

const noop = (): void => undefined;

/** The business today of the demos. */
const TODAY = '2026-10-08';

// The made-up staff (spec 12.1).
const CARMEN = { id: '0b0f6c1e-0000-4000-8000-000000000001', name: 'Carmen Reyes', formerStaff: false };
const LIZA = { id: '0b0f6c1e-0000-4000-8000-000000000002', name: 'Liza Mercado', formerStaff: false };
const PAOLO = { id: '0b0f6c1e-0000-4000-8000-000000000003', name: 'Paolo Garcia', formerStaff: false };
const JOMAR = { id: '0b0f6c1e-0000-4000-8000-000000000004', name: 'Jomar Santos', formerStaff: true };
const ANA = { id: '0b0f6c1e-0000-4000-8000-000000000005', name: 'Ana Villanueva', formerStaff: true };

/** A press on a static case does nothing: no link is followed and no window opens. */
function swallow(event: MouseEvent): void {
  event.preventDefault();
  event.stopPropagation();
}

/** The strip's Transfer button as a plain button: same look and gate, but it opens nothing and reads nothing. */
function DemoStrip({ query }: { query: MyMoneyCardQuery }) {
  const gate = transferGate(query);
  return (
    <MoneyStrip
      query={query}
      transfer={(reasonId) => (
        <Button
          variant="secondary"
          size="sm"
          icon="arrow-right"
          aria-disabled={gate.blocked}
          {...(gate.nothingOnHand ? { 'aria-describedby': reasonId } : {})}
          onClick={noop}
        >
          {TRANSFER.button}
        </Button>
      )}
    />
  );
}

/** Wraps a static case so that nothing in it can be pressed through to the app (it adds no box of its own). */
function Still({ children }: { children: ReactNode }) {
  return (
    <div className={stillClasses} onClickCapture={swallow}>
      {children}
    </div>
  );
}

// Dashboard summaries (spec 12.4).

const STATUS_ORDER = ['pending', 'mockup', 'production', 'ready', 'delivered', 'completed'] as const;

function statuses(counts: readonly number[]): DashboardSummaryResponse['statuses'] {
  return STATUS_ORDER.map((status, index) => ({ status, count: counts[index] ?? 0 }));
}

function order(
  overrides: Partial<OrderListEntry> & Pick<OrderListEntry, 'id' | 'number' | 'customerName'>,
): OrderListEntry {
  return {
    teamName: null,
    orderDate: '2026-09-28',
    dueDate: '2026-10-14',
    status: 'production',
    statusChangedAt: '2026-10-01T02:00:00Z',
    pieces: 20,
    subtotal: 0,
    discount: 0,
    total: 0,
    paid: 0,
    refunded: 0,
    balance: 0,
    customerCredit: 0,
    fullyPaid: false,
    imageCount: 0,
    cover: null,
    ...overrides,
  };
}

/** Six recent orders, newest first, one for each Balance and Due state: a balance due, Fully Paid, a walk-in that is overdue, a credit, a Delivered order past its date and a Cancelled order. */
const RECENT_ORDERS: OrderListEntry[] = [
  order({
    id: '0b0f6c1e-0000-4000-8000-0000000001a1',
    number: 'ORD-2026-0148',
    customerName: 'Juan Dela Cruz',
    teamName: 'Brgy. San Roque Ballers',
    subtotal: 22450,
    discount: 1122.5,
    total: 21327.5,
    paid: 12000,
    balance: 9327.5,
    pieces: 48,
  }),
  order({
    id: '0b0f6c1e-0000-4000-8000-0000000001a2',
    number: 'ORD-2026-0151',
    customerName: 'Mark Villanueva',
    teamName: 'Tondo Riders MC',
    status: 'ready',
    dueDate: '2026-10-10',
    subtotal: 23000,
    discount: 500,
    total: 22500,
    paid: 22500,
    fullyPaid: true,
  }),
  order({
    id: '0b0f6c1e-0000-4000-8000-0000000001a3',
    number: 'ORD-2026-0153',
    customerName: 'Angelica Santos',
    status: 'mockup',
    dueDate: '2026-10-05',
    subtotal: 9360,
    total: 9360,
    paid: 3000,
    balance: 6360,
    pieces: 12,
  }),
  order({
    id: '0b0f6c1e-0000-4000-8000-0000000001a4',
    number: 'ORD-2026-0160',
    customerName: 'Rhea Dizon',
    teamName: 'Lady Spikers QC',
    status: 'ready',
    dueDate: '2026-10-20',
    subtotal: 8000,
    total: 8000,
    paid: 9000,
    customerCredit: 1000,
    pieces: 10,
  }),
  order({
    id: '0b0f6c1e-0000-4000-8000-0000000001a5',
    number: 'ORD-2026-0150',
    customerName: 'Liza Cruz',
    teamName: 'St. Jude Parish Youth',
    status: 'delivered',
    dueDate: '2026-10-06',
    subtotal: 5000,
    total: 5000,
    paid: 2000,
    balance: 3000,
    pieces: 10,
  }),
  order({
    id: '0b0f6c1e-0000-4000-8000-0000000001a6',
    number: 'ORD-2026-0139',
    customerName: 'Jessa Ramos',
    teamName: 'Kabataan Liga ng Pasig',
    status: 'cancelled',
    orderDate: '2026-09-08',
    dueDate: '2026-09-25',
    subtotal: 8500,
    total: 8500,
    paid: 3000,
    refunded: 1000,
    balance: 5500,
    pieces: 10,
  }),
];

/** The 12.4 demo values: 18 active orders (4 due this week, 2 overdue), 84,260.00 owed, 126,450.00 collected (up 12%), 38,226.95 spent. */
const D1_SUMMARY: DashboardSummaryResponse = {
  today: TODAY,
  greeting: 'morning',
  firstName: 'Carmen',
  orders: { active: 18, dueThisWeek: 4, overdue: 2, receivables: 84260 },
  collected: { thisMonth: 126450, comparison: 112900, changePercent: 12, comparisonThrough: '2026-09-08' },
  expenses: { thisMonth: 38226.95, count: 9, topCategory: 'Rent' },
  statuses: statuses([3, 4, 7, 4, 0, 11]),
  recentOrders: RECENT_ORDERS,
};

/** A new shop: every figure is zero and nothing is listed. */
const NEW_SHOP_SUMMARY: DashboardSummaryResponse = {
  ...D1_SUMMARY,
  orders: { active: 0, dueThisWeek: 0, overdue: 0, receivables: 0 },
  collected: { thisMonth: 0, comparison: 0, changePercent: null, comparisonThrough: '2026-09-08' },
  expenses: { thisMonth: 0, count: 0, topCategory: null },
  statuses: statuses([0, 0, 0, 0, 0, 0]),
  recentOrders: [],
};

/** One large count (48 in production) and several zero counts. */
const LARGE_COUNT_SUMMARY: DashboardSummaryResponse = {
  ...D1_SUMMARY,
  orders: { active: 49, dueThisWeek: 9, overdue: 0, receivables: 301500 },
  statuses: statuses([0, 1, 48, 0, 0, 0]),
};

const FAILURE = new HttpError({ kind: 'http', status: 500 });

function summaryQuery(data: DashboardSummaryResponse | undefined, failed = false): DashboardCardQuery {
  return { data, isError: failed, error: failed ? FAILURE : null, refetch: noop };
}

const SUMMARY_OK = summaryQuery(D1_SUMMARY);
const SUMMARY_NEW = summaryQuery(NEW_SHOP_SUMMARY);
const SUMMARY_LOADING = summaryQuery(undefined);
const SUMMARY_FAILED = summaryQuery(undefined, true);

/** Six months ending Oct 2026 (the 12.4 values); July's expenses are above its income, so its profit is negative. */
const SIX_MONTHS: DashboardChartMonthFigures[] = [
  { month: '2026-05', income: 84200, expenses: 39800, profit: 44400 },
  { month: '2026-06', income: 91500, expenses: 42100, profit: 49400 },
  { month: '2026-07', income: 42000, expenses: 61500, profit: -19500 },
  { month: '2026-08', income: 98700, expenses: 44300, profit: 54400 },
  { month: '2026-09', income: 112900, expenses: 51200, profit: 61700 },
  { month: '2026-10', income: 126450, expenses: 58320, profit: 68130 },
];

/** Twelve months ending Oct 2026; January's refunds are above its payments, so its income is negative. */
const TWELVE_MONTHS: DashboardChartMonthFigures[] = [
  { month: '2025-11', income: 76000, expenses: 35000, profit: 41000 },
  { month: '2025-12', income: 140200, expenses: 58900, profit: 81300 },
  { month: '2026-01', income: -1500, expenses: 12000, profit: -13500 },
  { month: '2026-02', income: 64800, expenses: 33100, profit: 31700 },
  { month: '2026-03', income: 79300, expenses: 37600, profit: 41700 },
  { month: '2026-04', income: 88100, expenses: 40200, profit: 47900 },
  ...SIX_MONTHS,
];

interface ChartDemoProps {
  range: '6m' | '12m';
  items: DashboardChartMonthFigures[] | null;
  failed?: boolean;
}

/** The Income vs. expenses card on plain values. */
function ChartDemo({ range, items, failed = false }: ChartDemoProps) {
  return (
    <IncomeExpenseCardView
      range={range}
      months={range === '6m' ? 6 : 12}
      onRangeChange={noop}
      data={items === null ? null : toChartData(items)}
      loading={items === null && !failed}
      failed={failed}
      error={failed ? FAILURE : null}
      onRetry={noop}
      dimmed={false}
    />
  );
}

// The caller's money (spec 12.1).

function moneyQuery(balance: number | null, state: 'ok' | 'loading' | 'failed' = 'ok'): MyMoneyCardQuery {
  return {
    data: balance === null ? undefined : { userId: CARMEN.id, name: CARMEN.name, balance, today: TODAY },
    isError: state === 'failed',
    isFetching: state === 'loading',
    error: state === 'failed' ? FAILURE : null,
    refetch: noop,
  };
}

// The ledger: one page with every kind of row, a hand-over, a negative running balance and a deleted transfer.

type LedgerOverrides = Partial<LedgerEntryResponse>;

function ledgerEntry(overrides: LedgerOverrides): LedgerEntryResponse {
  return {
    kind: 'payment-received',
    date: '2026-10-28',
    recordedAtUtc: '2026-10-28T02:00:00Z',
    moneyIn: null,
    moneyOut: null,
    balanceAfter: null,
    orderId: null,
    orderNumber: null,
    team: null,
    customer: null,
    paymentMethod: null,
    category: null,
    description: null,
    counterpart: null,
    note: null,
    transferId: null,
    version: null,
    isHandover: false,
    recordedBy: null,
    isDeleted: false,
    deletedBy: null,
    deletedAtUtc: null,
    ...overrides,
  };
}

const ORDER_ID = '0b0f6c1e-0000-4000-8000-0000000000b1';

const LEDGER_ENTRIES: LedgerEntryResponse[] = [
  ledgerEntry({
    kind: 'order-expense',
    date: '2026-11-04',
    recordedAtUtc: '2026-11-04T05:00:00Z',
    moneyOut: 1450,
    balanceAfter: -500,
    orderId: ORDER_ID,
    orderNumber: 'ORD-2026-0148',
    category: 'Fabric',
    description: 'Extra dye lot',
  }),
  ledgerEntry({
    kind: 'company-expense',
    date: '2026-11-03',
    recordedAtUtc: '2026-11-03T05:00:00Z',
    moneyOut: 750,
    balanceAfter: 950,
    category: 'Utilities',
    description: 'Electric bill for October',
  }),
  ledgerEntry({
    kind: 'transfer-out',
    date: '2026-11-02',
    recordedAtUtc: '2026-11-02T05:00:00Z',
    moneyOut: 2000,
    balanceAfter: 1700,
    counterpart: LIZA,
    transferId: '0b0f6c1e-0000-4000-8000-0000000000c1',
    version: 'AAAAAAAAB9E=',
    isHandover: true,
    recordedBy: CARMEN,
  }),
  ledgerEntry({
    kind: 'transfer-in',
    date: '2026-11-01',
    recordedAtUtc: '2026-11-01T05:00:00Z',
    moneyIn: 2000,
    balanceAfter: 3700,
    counterpart: PAOLO,
    note: 'Cash for the fabric run',
    transferId: '0b0f6c1e-0000-4000-8000-0000000000c2',
    version: 'AAAAAAAAB9F=',
    recordedBy: PAOLO,
  }),
  ledgerEntry({
    kind: 'refund-handed-back',
    date: '2026-10-30',
    recordedAtUtc: '2026-10-30T05:00:00Z',
    moneyOut: 300,
    balanceAfter: 1700,
    orderId: ORDER_ID,
    orderNumber: 'ORD-2026-0148',
    team: 'Blue Hawks',
    customer: 'Rico Dela Cruz',
  }),
  ledgerEntry({
    kind: 'payment-received',
    moneyIn: 2000,
    balanceAfter: 2000,
    orderId: ORDER_ID,
    orderNumber: 'ORD-2026-0148',
    team: 'Blue Hawks',
    customer: 'Rico Dela Cruz',
    paymentMethod: 'GCash',
  }),
  ledgerEntry({
    kind: 'transfer-out',
    date: '2026-10-06',
    recordedAtUtc: '2026-10-06T05:00:00Z',
    moneyOut: 2000,
    counterpart: LIZA,
    transferId: '0b0f6c1e-0000-4000-8000-0000000000c3',
    version: 'AAAAAAAAB9G=',
    isDeleted: true,
    deletedBy: CARMEN,
    deletedAtUtc: '2026-10-08T07:42:00Z',
    recordedBy: CARMEN,
  }),
];

const LEDGER_PAGE = parseLedgerPage({
  balance: -500,
  includesDeleted: true,
  items: LEDGER_ENTRIES,
  page: 1,
  pageSize: 20,
  total: LEDGER_ENTRIES.length,
});

const LEDGER_EMPTY = parseLedgerPage({
  balance: 0,
  includesDeleted: false,
  items: [],
  page: 1,
  pageSize: 20,
  total: 0,
});

// All Staff: the signed-in Manager, a negative active person, a person at zero, a deleted person owed money and a deactivated person
// holding money.

const STAFF_BALANCES = parseStaffBalances({
  items: [
    { userId: CARMEN.id, name: CARMEN.name, role: 'Manager', status: 'active', balance: 8450, isYou: true },
    { userId: LIZA.id, name: LIZA.name, role: 'Admin', status: 'active', balance: -500, isYou: false },
    { userId: PAOLO.id, name: PAOLO.name, role: 'Admin', status: 'active', balance: 0, isYou: false },
    { userId: ANA.id, name: ANA.name, role: 'Admin', status: 'deleted', balance: -300, isYou: false },
    { userId: JOMAR.id, name: JOMAR.name, role: 'Admin', status: 'deactivated', balance: 2000, isYou: false },
  ],
  total: 9650,
});

const STAFF_QUERY: StaffBalancesTableQuery = {
  data: STAFF_BALANCES,
  isError: false,
  isFetching: false,
  error: null,
  refetch: noop,
};

// The Transfers table: a counted transfer and a deleted one.

const TRANSFER_PAGE = parseTransferPage({
  items: [
    {
      id: '0b0f6c1e-0000-4000-8000-0000000000d1',
      amount: 2000,
      from: PAOLO,
      to: LIZA,
      transferDate: '2026-10-06',
      note: 'Cash for the fabric run',
      isDeleted: false,
      isHandover: false,
      deletedAtUtc: null,
      deletedBy: null,
      recordedAtUtc: '2026-10-06T05:00:00Z',
      recordedBy: CARMEN,
      version: 'AAAAAAAAB9E=',
    },
    {
      id: '0b0f6c1e-0000-4000-8000-0000000000d2',
      amount: 2000,
      from: PAOLO,
      to: LIZA,
      transferDate: '2026-10-06',
      note: null,
      isDeleted: true,
      isHandover: false,
      deletedAtUtc: '2026-10-08T07:42:00Z',
      deletedBy: CARMEN,
      recordedAtUtc: '2026-10-06T05:00:00Z',
      recordedBy: CARMEN,
      version: 'AAAAAAAAB9F=',
    },
  ],
  page: 1,
  pageSize: 20,
  total: 2,
});

const [COUNTED_ROW, DELETED_ROW] = TRANSFER_PAGE.rows;
if (COUNTED_ROW === undefined || DELETED_ROW === undefined) {
  throw new Error('The demo transfers are missing.');
}
const COUNTED_TARGET = toTransferTarget(COUNTED_ROW);
const DELETED_TARGET = toTransferTarget(DELETED_ROW);

// The Transfer and Hand Over windows.

const PEOPLE: TransferPerson[] = [
  { id: CARMEN.id, name: CARMEN.name, status: 'active', isYou: true },
  { id: LIZA.id, name: LIZA.name, status: 'active', isYou: false },
  { id: PAOLO.id, name: PAOLO.name, status: 'active', isYou: false },
  { id: ANA.id, name: ANA.name, status: 'deleted', isYou: false },
];

const RECIPIENTS = { data: PEOPLE, isPending: false, isSuccess: true, isError: false } as const;

/** Ana is owed 300.00, so a Manager's transfer to her is capped there (D-49). */
const OWED = new Map([[ANA.id, { name: ANA.name, owed: 300 }]]);

/** The leaver the Hand Over demo takes money from. */
const LEAVER = { userId: JOMAR.id, name: JOMAR.name, status: 'deactivated', balance: 2000 } as const;

/** A 400 in the server's problem shape: a message under Amount, as the server words it. */
function refusal(message: string): HttpError {
  return new HttpError({
    kind: 'http',
    status: 400,
    problem: {
      type: undefined,
      title: 'Check the highlighted fields.',
      status: 400,
      detail: undefined,
      instance: undefined,
      traceId: undefined,
      code: 'money-transfers.invalid-request',
      errors: { Amount: [message] },
    },
  });
}

/** A made-up saved transfer: the window's success path shows its toast and closes. */
const SAVED: TransferSavedResponse = {
  senderBalance: 6450,
  transfer: {
    id: '0b0f6c1e-0000-4000-8000-0000000000a1',
    amount: 2000,
    from: CARMEN,
    to: LIZA,
    transferDate: TODAY,
    note: null,
    isDeleted: false,
    isHandover: false,
    deletedAtUtc: null,
    deletedBy: null,
    recordedAtUtc: '2026-10-08T02:00:00Z',
    recordedBy: CARMEN,
    version: 'AAAAAAAAB9E=',
  },
};

interface WindowDemoProps {
  mode: 'transfer' | 'handover';
  /** The server turns the save down with its own words under Amount. */
  refused?: boolean;
  trigger: string;
}

/** The Transfer Money or Hand Over Money window on demo data. Nothing is sent: the save is made up here. */
function WindowDemo({ mode, refused = false, trigger }: WindowDemoProps) {
  const [open, setOpen] = useState(false);
  const close = (): void => {
    setOpen(false);
  };
  const handover = mode === 'handover';
  // The browser's check passed on what it was told; a refusing server knows the balance moved since.
  const send = (): Promise<TransferSavedResponse> =>
    refused
      ? Promise.reject(
          refusal(
            handover
              ? HANDOVER.errors.aboveBalance(LEAVER.name, formatPeso(300))
              : TRANSFER.errors.aboveBalance(formatPeso(200)),
          ),
        )
      : Promise.resolve(SAVED);
  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          setOpen(true);
        }}
      >
        {trigger}
      </Button>
      {open &&
        (handover ? (
          <TransferForm
            open
            today={TODAY}
            leaver={LEAVER}
            name={LEAVER.name}
            balance={LEAVER.balance}
            owedByRecipient={undefined}
            recipients={RECIPIENTS}
            onRefreshBalance={noop}
            onRefreshPeople={noop}
            onClose={close}
            send={send}
          />
        ) : (
          <TransferForm
            open
            today={TODAY}
            leaver={undefined}
            name={CARMEN.name}
            balance={8450}
            owedByRecipient={OWED}
            recipients={RECIPIENTS}
            onRefreshBalance={noop}
            onRefreshPeople={noop}
            onClose={close}
            send={send}
          />
        ))}
    </>
  );
}

interface DeleteDemoProps {
  /** The receiver's balance after the delete is below zero, so the warning shows. */
  warned: boolean;
  trigger: string;
}

/** The Delete Transfer confirm on demo data. Confirming only closes it. */
function DeleteDemo({ warned, trigger }: DeleteDemoProps) {
  const [open, setOpen] = useState(false);
  const close = (): void => {
    setOpen(false);
  };
  return (
    <>
      <Button
        variant="danger"
        size="sm"
        onClick={() => {
          setOpen(true);
        }}
      >
        {trigger}
      </Button>
      <DeleteTransferView
        transfer={COUNTED_TARGET}
        open={open}
        warnAmount={warned ? -500 : null}
        checking={false}
        checkFailed={false}
        onConfirm={close}
        onClose={close}
      />
    </>
  );
}

/** The Remove Permanently confirm on demo data. Confirming only closes it. */
function RemoveDemo() {
  const [open, setOpen] = useState(false);
  const close = (): void => {
    setOpen(false);
  };
  return (
    <>
      <Button
        variant="danger"
        size="sm"
        onClick={() => {
          setOpen(true);
        }}
      >
        {DEMO.openRemove}
      </Button>
      <RemoveTransferView transfer={DELETED_TARGET} open={open} onConfirm={close} onClose={close} />
    </>
  );
}

/** The dashboard as the page lays it out: the strip, the KPI row, the chart beside Orders by status, then Recent orders. */
function DashboardDemo({
  summary,
  money,
  chart,
}: {
  summary: DashboardCardQuery;
  money: MyMoneyCardQuery;
  chart: ReactNode;
}) {
  return (
    <Still>
      <DemoStrip query={money} />
      <DashboardKpiRow query={summary} />
      <div className={dashboardRowClasses}>
        {chart}
        <OrdersByStatusCard query={summary} />
      </div>
      <RecentOrdersCard query={summary} />
    </Still>
  );
}

/** Every Phase 10 demo, one case under another. */
export function Phase10Demos() {
  // The windows' save would read the money answers again; a client of their own keeps that off the app's cache.
  const [client] = useState(createQueryClient);
  return (
    <QueryClientProvider client={client}>
      <div className={staffStackClasses}>
        <DemoCase id="dashboard-d1-demo">
          <DashboardDemo
            summary={SUMMARY_OK}
            money={moneyQuery(8450)}
            chart={<ChartDemo range="6m" items={SIX_MONTHS} />}
          />
        </DemoCase>
        <DemoCase id="dashboard-new-shop">
          <DashboardDemo
            summary={SUMMARY_NEW}
            money={moneyQuery(0)}
            chart={<ChartDemo range="6m" items={emptyMonths()} />}
          />
        </DemoCase>
        <DemoCase id="dashboard-cards-loading">
          <DashboardDemo
            summary={SUMMARY_LOADING}
            money={moneyQuery(null, 'loading')}
            chart={<ChartDemo range="6m" items={null} />}
          />
        </DemoCase>
        <DemoCase id="dashboard-cards-error">
          <DashboardDemo
            summary={SUMMARY_FAILED}
            money={moneyQuery(null, 'failed')}
            chart={<ChartDemo range="6m" items={null} failed />}
          />
        </DemoCase>
        <DemoCase id="dashboard-chart-6m">
          <Still>
            <ChartDemo range="6m" items={SIX_MONTHS} />
          </Still>
        </DemoCase>
        <DemoCase id="dashboard-chart-12m">
          <Still>
            <ChartDemo range="12m" items={TWELVE_MONTHS} />
          </Still>
        </DemoCase>
        <DemoCase id="dashboard-orders-by-status">
          <Still>
            <OrdersByStatusCard query={summaryQuery(LARGE_COUNT_SUMMARY)} />
          </Still>
        </DemoCase>
        <DemoCase id="dashboard-recent-orders">
          <Still>
            <RecentOrdersCard query={SUMMARY_OK} />
          </Still>
        </DemoCase>
        <DemoCase id="money-strip-negative">
          <Still>
            <DemoStrip query={moneyQuery(-500)} />
          </Still>
        </DemoCase>
        <DemoCase id="money-strip-states">
          <Still>
            <div className={moneyCaseColumnClasses}>
              <DemoStrip query={moneyQuery(0)} />
              <DemoStrip query={moneyQuery(null, 'loading')} />
              <DemoStrip query={moneyQuery(null, 'failed')} />
            </div>
          </Still>
        </DemoCase>
        <DemoCase id="money-on-hand-states">
          <Still>
            <div className={orderTotalsGridClasses}>
              <MoneyOnHandCard query={moneyQuery(8450)} />
              <MoneyOnHandCard query={moneyQuery(-500)} />
              <MoneyOnHandCard query={moneyQuery(0)} />
              <MoneyOnHandCard query={moneyQuery(null, 'loading')} />
              <MoneyOnHandCard query={moneyQuery(null, 'failed')} />
            </div>
          </Still>
        </DemoCase>
        <DemoCase id="money-ledger-kinds">
          <Still>
            <LedgerTable page={LEDGER_PAGE} canSeeActions owner={CARMEN} onDelete={noop} onRemove={noop} />
          </Still>
        </DemoCase>
        <DemoCase id="money-ledger-states">
          <Still>
            <div className={moneyCaseColumnClasses}>
              <LedgerTable page={undefined} pending />
              <LedgerTable page={LEDGER_EMPTY} />
              <LedgerTable page={undefined} failed error={FAILURE} onRetry={noop} />
            </div>
          </Still>
        </DemoCase>
        <DemoCase id="money-all-staff">
          <Still>
            <div className={phoneRowWidthClasses}>
              <StaffBalancesTable query={STAFF_QUERY} onHandOver={noop} />
            </div>
          </Still>
        </DemoCase>
        <DemoCase id="money-transfers-table">
          <Still>
            <TransfersTable page={TRANSFER_PAGE} onDelete={noop} onRemove={noop} />
          </Still>
        </DemoCase>
        <DemoCase id="money-transfer-window" live>
          <WindowDemo mode="transfer" trigger={DEMO.openTransfer} />
          <WindowDemo mode="transfer" refused trigger={DEMO.openTransferRefused} />
        </DemoCase>
        <DemoCase id="money-hand-over-window" live>
          <WindowDemo mode="handover" trigger={DEMO.openHandover} />
          <WindowDemo mode="handover" refused trigger={DEMO.openHandoverRefused} />
        </DemoCase>
        <DemoCase id="money-delete-dialog" live>
          <DeleteDemo warned trigger={DEMO.openDeleteWarning} />
          <DeleteDemo warned={false} trigger={DEMO.openDelete} />
        </DemoCase>
        <DemoCase id="money-remove-dialog" live>
          <RemoveDemo />
        </DemoCase>
      </div>
    </QueryClientProvider>
  );
}

/** Six months with no money in or out. */
function emptyMonths(): DashboardChartMonthFigures[] {
  return SIX_MONTHS.map(({ month }) => ({ month, income: 0, expenses: 0, profit: 0 }));
}
