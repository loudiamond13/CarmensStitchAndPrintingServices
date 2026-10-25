// Company expense list fixtures for component and service tests (plan 06-04): response builders typed from the generated
// contract, and an MSW handler that records every request. Later expense plans reuse them. Long text for the wrap checks
// is here too: a 200-character description and a 100-character staff name (UI-SPEC UI Considerations, long-text). Plan 06-07
// adds the category list the filter reads, and plan 06-09 the month KPI figures.
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type ExpenseListItemFixture = Schemas['CompanyExpenseListItem'];
export type ExpenseListResponseFixture = Schemas['CompanyExpenseListResponse'];
export type ActorFixture = Schemas['ActorRef'];
export type CategoryFixture = Schemas['ExpenseCategoryRef'];
export type CategoryListItemFixture = Schemas['ExpenseCategoryListItem'];

/** The business today the fixtures answer with. */
export const EXPENSE_TODAY = '2026-10-25';
export const EXPENSE_WINDOW = { from: '2026-09-25', to: '2026-11-24' } as const;

export const LONG_DESCRIPTION = `${'Meralco bill '.repeat(16)}end`.slice(0, 200);
export const LONG_NAME = `Maria ${'Santos'.repeat(16)}`.slice(0, 100);

export const RENT: CategoryFixture = {
  id: '6869715c-a01f-4053-87d8-8fd39feebebc',
  name: 'Rent',
  tone: 'accent',
  retired: false,
};
export const SUPPLIES: CategoryFixture = {
  id: '447ad32e-1433-4b70-8786-72e3dc3f9937',
  name: 'Supplies',
  tone: 'warning',
  retired: false,
};

export function actor(name: string, overrides: Partial<ActorFixture> = {}): ActorFixture {
  return {
    id: `00000000-0000-4000-8000-${String(name.length).padStart(12, '0')}`,
    name,
    formerStaff: false,
    ...overrides,
  };
}

export const CARMEN = actor('Carmen Reyes');
export const PAOLO = actor('Paolo Garcia');

export function expenseItem(id: string, overrides: Partial<ExpenseListItemFixture> = {}): ExpenseListItemFixture {
  return {
    id,
    date: '2026-10-06',
    category: RENT,
    description: 'Shop rent for October',
    amount: 12450,
    paidBy: CARMEN,
    recordedBy: CARMEN,
    canEdit: true,
    ...overrides,
  };
}

export function expenseList(
  items: readonly ExpenseListItemFixture[],
  overrides: Partial<ExpenseListResponseFixture> = {},
): ExpenseListResponseFixture {
  return {
    items: [...items],
    total: items.length,
    page: 1,
    pageSize: 20,
    periodTotal: items.reduce((sum, item) => sum + Number(item.amount), 0),
    from: EXPENSE_WINDOW.from,
    to: EXPENSE_WINDOW.to,
    today: EXPENSE_TODAY,
    ...overrides,
  };
}

/** What the fake API answers for one request: a page, or a ready-made response. */
export type ExpenseResponder = (
  url: URL,
) => ExpenseListResponseFixture | Response | Promise<ExpenseListResponseFixture | Response>;

/** Answers GET /api/v1/company-expenses (and, by default, the category list) and records every list request URL. */
export function expensesBackend(answer: ExpenseListResponseFixture | ExpenseResponder): { calls: URL[] } {
  const calls: URL[] = [];
  // The page also reads the category list and the month figures; a test that cares calls categoriesBackend or kpisBackend after this.
  categoriesBackend();
  kpisBackend();
  server.use(
    http.get('*/api/v1/company-expenses', async ({ request }) => {
      const url = new URL(request.url);
      calls.push(url);
      const body = typeof answer === 'function' ? await answer(url) : answer;
      return body instanceof Response ? body : HttpResponse.json(body);
    }),
  );
  return { calls };
}

export type ExpenseKpisFixture = Schemas['CompanyExpenseKpisResponse'];
export type MonthKpiFixture = Schemas['MonthKpi'];

/** The month figures the fixtures answer with: October (this month) and September, Supplies on top with 71 percent. */
export function expenseKpis(overrides: Partial<ExpenseKpisFixture> = {}): ExpenseKpisFixture {
  return {
    today: EXPENSE_TODAY,
    thisMonth: { month: '2026-10-01', total: 700, count: 2 },
    lastMonth: { month: '2026-09-01', total: 300, count: 1 },
    topCategory: { category: SUPPLIES, total: 500, sharePercent: 71 },
    ...overrides,
  };
}

/** What the fake API answers for one KPI request: the figures, or a ready-made response. */
export type KpisResponder = (url: URL) => ExpenseKpisFixture | Response | Promise<ExpenseKpisFixture | Response>;

/** Answers GET /api/v1/company-expenses/kpis and records every request URL. A later call overrides an earlier one. */
export function kpisBackend(answer: ExpenseKpisFixture | KpisResponder = expenseKpis()): { calls: URL[] } {
  const calls: URL[] = [];
  server.use(
    http.get('*/api/v1/company-expenses/kpis', async ({ request }) => {
      const url = new URL(request.url);
      calls.push(url);
      const body = typeof answer === 'function' ? await answer(url) : answer;
      return body instanceof Response ? body : HttpResponse.json(body);
    }),
  );
  return { calls };
}

/** A problem+json answer with a status. */
export function problemResponse(status: number): Response {
  return new HttpResponse(JSON.stringify({ title: 'x', status }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

function categoryItem(
  id: string,
  name: string,
  tone: string,
  overrides: Partial<CategoryListItemFixture> = {},
): CategoryListItemFixture {
  return { id, name, tone, status: 'active', isOthers: false, expenseCount: 0, ...overrides };
}

export const OTHERS_ID = 'f85e6b1c-b46f-4a00-8c4e-5148eb3b9704';
export const RETIRED_CATEGORY_ID = '0b1d6f6e-3c3a-4d6e-9b7a-5c1f0e2a7d11';

/** What GET /api/v1/expense-categories answers: the ten seeded categories A to Z with Others last, and one retired extra. */
export const EXPENSE_CATEGORIES: readonly CategoryListItemFixture[] = [
  categoryItem('b9c92751-7040-4edd-bd44-de110104cb01', 'Equipment', 'success'),
  categoryItem('b27a1f8a-5262-48c8-bca4-41e04583e015', 'Government contributions', 'info'),
  categoryItem('b74d786b-8092-4e67-a0ba-a419e9d1ba75', 'Maintenance', 'neutral'),
  categoryItem(RETIRED_CATEGORY_ID, 'Old subscriptions', 'accent', { status: 'retired' }),
  categoryItem(RENT.id, RENT.name, RENT.tone),
  categoryItem('d2aa53b4-7ebd-445e-b318-94ce1d21cbf2', 'Salaries', 'mockup'),
  categoryItem(SUPPLIES.id, SUPPLIES.name, SUPPLIES.tone),
  categoryItem('c8392b0c-ee0e-4a71-ba47-b137fdd1d8c0', 'Taxes and permits', 'mockup'),
  categoryItem('eb48e6a0-08a8-4509-9f5e-7b81167071de', 'Transport and fuel', 'warning'),
  categoryItem('51702a8f-81e4-4a20-8e39-2d4b270793de', 'Utilities', 'info'),
  categoryItem(OTHERS_ID, 'Others', 'neutral', { isOthers: true }),
];

/** What the fake API answers for the category list: the list, or a ready-made response. */
export type CategoryResponder = (
  url: URL,
) => readonly CategoryListItemFixture[] | Response | Promise<readonly CategoryListItemFixture[] | Response>;

/** Answers GET /api/v1/expense-categories and records every request URL. A later call overrides an earlier one. */
export function categoriesBackend(
  answer: readonly CategoryListItemFixture[] | CategoryResponder = EXPENSE_CATEGORIES,
): {
  calls: URL[];
} {
  const calls: URL[] = [];
  server.use(
    http.get('*/api/v1/expense-categories', async ({ request }) => {
      const url = new URL(request.url);
      calls.push(url);
      const body = typeof answer === 'function' ? await answer(url) : answer;
      return body instanceof Response ? body : HttpResponse.json(body);
    }),
  );
  return { calls };
}

export type StaffMemberFixture = Schemas['StaffMember'];
export type ExpenseDetailFixture = Schemas['CompanyExpenseDetailResponse'];

/** The signed-in user of sessionResponse() in test/sessionFixtures.ts (Carmen Reyes). */
export const ME_ID = '5f0c4a1e-8c1d-4a52-9d0e-1a2b3c4d5e6f';
/** The signed-in user as an actor: the payer and recorder of `expenseDetail()` unless a test says otherwise. */
export const ME_ACTOR: ActorFixture = { id: ME_ID, name: 'Carmen Reyes', formerStaff: false };
export const LIZA_ID = '00000000-0000-4000-8000-0000000000a2';
export const PAOLO_ID = '00000000-0000-4000-8000-0000000000a3';

/** What GET /api/v1/staff answers: the people who can pay, by first name. */
export const STAFF: readonly StaffMemberFixture[] = [
  { id: ME_ID, name: 'Carmen Reyes' },
  { id: LIZA_ID, name: 'Liza Mercado' },
  { id: PAOLO_ID, name: 'Paolo Garcia' },
];

/** What the fake API answers for the staff lookup: the people, or a ready-made response. */
export type StaffResponder = (
  url: URL,
) => readonly StaffMemberFixture[] | Response | Promise<readonly StaffMemberFixture[] | Response>;

/** Answers GET /api/v1/staff and records every request URL. A later call overrides an earlier one. */
export function staffBackend(answer: readonly StaffMemberFixture[] | StaffResponder = STAFF): { calls: URL[] } {
  const calls: URL[] = [];
  server.use(
    http.get('*/api/v1/staff', async ({ request }) => {
      const url = new URL(request.url);
      calls.push(url);
      const body = typeof answer === 'function' ? await answer(url) : answer;
      return body instanceof Response ? body : HttpResponse.json(body);
    }),
  );
  return { calls };
}

/** One saved expense as POST /api/v1/company-expenses answers it (Carmen recorded and paid it). */
export function expenseDetail(overrides: Partial<ExpenseDetailFixture> = {}): ExpenseDetailFixture {
  return {
    id: '00000000-0000-4000-8000-0000000000e1',
    date: EXPENSE_TODAY,
    category: SUPPLIES,
    description: 'Thread and needles',
    amount: 640,
    notes: null,
    paidBy: ME_ACTOR,
    paidByActive: true,
    recordedBy: ME_ACTOR,
    recordedAt: '2026-10-25T04:00:00Z',
    lastChangedBy: null,
    lastChangedAt: null,
    canEdit: true,
    version: 'AAAAAAAAB9E=',
    ...overrides,
  };
}

/** What the fake API received for one create. */
export interface CreateCalls {
  bodies: unknown[];
  keys: (string | null)[];
}

/** Answers POST /api/v1/company-expenses (default: 201 with `expenseDetail()`) and records each body and Idempotency-Key. */
export function createExpenseBackend(
  reply: () => Response | Promise<Response> = () => HttpResponse.json(expenseDetail(), { status: 201 }),
): CreateCalls {
  const calls: CreateCalls = { bodies: [], keys: [] };
  server.use(
    http.post('*/api/v1/company-expenses', async ({ request }) => {
      calls.bodies.push(await request.json());
      calls.keys.push(request.headers.get('Idempotency-Key'));
      return reply();
    }),
  );
  return calls;
}

/** What the fake API answers for one detail read: the expense, or a ready-made response. */
export type DetailResponder = (
  id: string,
) => ExpenseDetailFixture | Response | Promise<ExpenseDetailFixture | Response>;

/** Answers GET /api/v1/company-expenses/{id} and records each id read. A later call overrides an earlier one. */
export function expenseDetailBackend(answer: ExpenseDetailFixture | DetailResponder = expenseDetail()): {
  ids: string[];
} {
  const ids: string[] = [];
  server.use(
    http.get('*/api/v1/company-expenses/:id', async ({ params }) => {
      const id = String(params.id);
      // The month figures and the deleted list share the prefix; let their own handlers answer.
      if (id === 'kpis' || id === 'deleted') {
        return undefined;
      }
      ids.push(id);
      const body = typeof answer === 'function' ? await answer(id) : answer;
      return body instanceof Response ? body : HttpResponse.json(body);
    }),
  );
  return { ids };
}

/** What the fake API received for one edit. */
export interface UpdateCalls {
  ids: string[];
  bodies: unknown[];
  keys: (string | null)[];
}

/** Answers PUT /api/v1/company-expenses/{id} (default: 200 with `expenseDetail()`) and records each id, body and Idempotency-Key. */
export function updateExpenseBackend(
  reply: () => Response | Promise<Response> = () => HttpResponse.json(expenseDetail()),
): UpdateCalls {
  const calls: UpdateCalls = { ids: [], bodies: [], keys: [] };
  server.use(
    http.put('*/api/v1/company-expenses/:id', async ({ params, request }) => {
      calls.ids.push(String(params.id));
      calls.bodies.push(await request.json());
      calls.keys.push(request.headers.get('Idempotency-Key'));
      return reply();
    }),
  );
  return calls;
}

/** A problem+json answer with a status and a machine code. */
export function codedProblemResponse(status: number, code: string): Response {
  return new HttpResponse(JSON.stringify({ title: 'x', status, code }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

/** What the fake API received for one delete, restore or permanent delete. */
export interface ActionCalls {
  ids: string[];
  keys: (string | null)[];
}

const noContent = (): Response => new HttpResponse(null, { status: 204 });

/** Answers DELETE /api/v1/company-expenses/{id} (default: 204) and records each id and Idempotency-Key. */
export function deleteExpenseBackend(reply: (id: string) => Response | Promise<Response> = noContent): ActionCalls {
  const calls: ActionCalls = { ids: [], keys: [] };
  server.use(
    http.delete('*/api/v1/company-expenses/:id', ({ params, request }) => {
      const id = String(params.id);
      calls.ids.push(id);
      calls.keys.push(request.headers.get('Idempotency-Key'));
      return reply(id);
    }),
  );
  return calls;
}

export type DeletedExpenseItemFixture = Schemas['DeletedExpenseListItem'];
export type DeletedExpenseListFixture = Schemas['DeletedExpenseListResponse'];

/** One row of the deleted list: deleted by Carmen at 3:42 PM Manila time on Oct 12, 2026 unless a test says otherwise. */
export function deletedExpenseItem(
  id: string,
  overrides: Partial<DeletedExpenseItemFixture> = {},
): DeletedExpenseItemFixture {
  return {
    id,
    deletedAt: '2026-10-12T07:42:00Z',
    deletedBy: CARMEN,
    date: '2026-10-06',
    category: RENT,
    description: 'Shop rent for October',
    amount: 12450,
    paidBy: CARMEN,
    ...overrides,
  };
}

export function deletedExpenseList(
  items: readonly DeletedExpenseItemFixture[],
  overrides: Partial<DeletedExpenseListFixture> = {},
): DeletedExpenseListFixture {
  return { items: [...items], total: items.length, page: 1, pageSize: 20, ...overrides };
}

/** What the fake API answers for one deleted-list request: a page, or a ready-made response. */
export type DeletedResponder = (
  url: URL,
) => DeletedExpenseListFixture | Response | Promise<DeletedExpenseListFixture | Response>;

/** Answers GET /api/v1/company-expenses/deleted (and the category list) and records every request URL. */
export function deletedExpensesBackend(answer: DeletedExpenseListFixture | DeletedResponder): { calls: URL[] } {
  const calls: URL[] = [];
  categoriesBackend();
  server.use(
    http.get('*/api/v1/company-expenses/deleted', async ({ request }) => {
      const url = new URL(request.url);
      calls.push(url);
      const body = typeof answer === 'function' ? await answer(url) : answer;
      return body instanceof Response ? body : HttpResponse.json(body);
    }),
  );
  return { calls };
}

/** Answers POST /api/v1/company-expenses/{id}/restore (default: 204) and records each id and Idempotency-Key. */
export function restoreExpenseBackend(reply: (id: string) => Response | Promise<Response> = noContent): ActionCalls {
  const calls: ActionCalls = { ids: [], keys: [] };
  server.use(
    http.post('*/api/v1/company-expenses/:id/restore', ({ params, request }) => {
      const id = String(params.id);
      calls.ids.push(id);
      calls.keys.push(request.headers.get('Idempotency-Key'));
      return reply(id);
    }),
  );
  return calls;
}
