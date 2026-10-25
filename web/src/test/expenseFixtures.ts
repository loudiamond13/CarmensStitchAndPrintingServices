// Company expense list fixtures for component and service tests (plan 06-04): response builders typed from the generated
// contract, and an MSW handler that records every request. Later expense plans reuse them. Long text for the wrap checks
// is here too: a 200-character description and a 100-character staff name (UI-SPEC UI Considerations, long-text).
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type ExpenseListItemFixture = Schemas['CompanyExpenseListItem'];
export type ExpenseListResponseFixture = Schemas['CompanyExpenseListResponse'];
export type ActorFixture = Schemas['ActorRef'];
export type CategoryFixture = Schemas['ExpenseCategoryRef'];

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

/** Answers GET /api/v1/company-expenses and records every request URL. */
export function expensesBackend(answer: ExpenseListResponseFixture | ExpenseResponder): { calls: URL[] } {
  const calls: URL[] = [];
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

/** A problem+json answer with a status. */
export function problemResponse(status: number): Response {
  return new HttpResponse(JSON.stringify({ title: 'x', status }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}
