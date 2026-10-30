// The four Settings lists as configs (D-31; plan 08-08): what ListSettingsSection and CategoryModal need to run one list, so the Phase 6
// category card serves product types, payment methods, order expense categories and company expense categories alike.
import type { UseQueryResult } from '@tanstack/react-query';
import type { ListKey } from '@/modules/admin/components/ListEntrySelect';
import { expenseCategoriesKey, useExpenseCategoriesQuery } from '@/modules/admin/hooks/useExpenseCategoriesQuery';
import {
  orderExpenseCategoriesKey,
  useOrderExpenseCategoriesQuery,
} from '@/modules/admin/hooks/useOrderExpenseCategoriesQuery';
import { paymentMethodsKey, usePaymentMethodsQuery } from '@/modules/admin/hooks/usePaymentMethodsQuery';
import { productTypesKey, useProductTypesQuery } from '@/modules/admin/hooks/useProductTypesQuery';
import { ORDER_LISTS_COPY } from '@/modules/admin/orderListsCopy';
import { expenseCategoriesService } from '@/modules/admin/services/expenseCategoriesService';
import { orderExpenseCategoriesService } from '@/modules/admin/services/orderExpenseCategoriesService';
import { paymentMethodsService } from '@/modules/admin/services/paymentMethodsService';
import { productTypesService } from '@/modules/admin/services/productTypesService';
import type { ListSettingsWords } from '@/modules/admin/settingsCopy';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

/** One row of any Settings list: the order lists count `useCount`, the company categories `expenseCount`. */
export type SettingsListRow = Schemas['OrderListItem'] | Schemas['ExpenseCategoryListItem'];

/** What the edit form reads of a saved entry; every list's detail answer carries these. */
export interface ListEntryDetail {
  readonly id: string;
  readonly name: string;
  readonly tone: string;
  readonly isOthers: boolean;
  readonly version: string;
  readonly recordedBy: Schemas['ActorRef'] | null;
  readonly recordedAt: string;
  readonly lastChangedBy: Schemas['ActorRef'] | null;
  readonly lastChangedAt: string | null;
}

/** The calls one list makes; the four services all fit this shape. */
export interface ListSettingsService {
  create(body: { name: string; tone: string }, idempotencyKey: string): Promise<{ id: string; name: string }>;
  get(id: string, signal?: AbortSignal): Promise<ListEntryDetail>;
  update(id: string, body: { name: string; tone: string; version: string }): Promise<{ id: string; name: string }>;
  retire(id: string, idempotencyKey: string): Promise<void>;
  reactivate(id: string, idempotencyKey: string): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface ListSettingsConfig {
  readonly list: ListKey;
  readonly words: ListSettingsWords;
  readonly service: ListSettingsService;
  /** Reads the list (a hook: the section calls it once). */
  readonly useEntries: () => UseQueryResult<SettingsListRow[]>;
  /** The cache key of the list, so Retire and Use again can flip a row at once. */
  readonly entriesKey: readonly string[];
  /** How many records use the row; a row with none can be deleted. */
  readonly countOf: (row: SettingsListRow) => number;
  /** The 422 code the server answers when a record started using the entry (D-30). */
  readonly inUseCode: string;
}

/** The generated types allow a number or text for a number; the server sends a number. */
const toNumber = (value: number | string): number => Number(value);

const orderListCount = (row: SettingsListRow): number => ('useCount' in row ? toNumber(row.useCount) : 0);
const companyCount = (row: SettingsListRow): number => ('expenseCount' in row ? toNumber(row.expenseCount) : 0);

export const LIST_SETTINGS: Readonly<Record<ListKey, ListSettingsConfig>> = {
  'product-types': {
    list: 'product-types',
    words: ORDER_LISTS_COPY['product-types'].settings,
    service: productTypesService,
    useEntries: useProductTypesQuery,
    entriesKey: productTypesKey,
    countOf: orderListCount,
    inUseCode: 'product-types.in-use',
  },
  'payment-methods': {
    list: 'payment-methods',
    words: ORDER_LISTS_COPY['payment-methods'].settings,
    service: paymentMethodsService,
    useEntries: usePaymentMethodsQuery,
    entriesKey: paymentMethodsKey,
    countOf: orderListCount,
    inUseCode: 'payment-methods.in-use',
  },
  'order-expense-categories': {
    list: 'order-expense-categories',
    words: ORDER_LISTS_COPY['order-expense-categories'].settings,
    service: orderExpenseCategoriesService,
    useEntries: useOrderExpenseCategoriesQuery,
    entriesKey: orderExpenseCategoriesKey,
    countOf: orderListCount,
    inUseCode: 'order-expense-categories.in-use',
  },
  'expense-categories': {
    list: 'expense-categories',
    words: ORDER_LISTS_COPY['expense-categories'].settings,
    service: expenseCategoriesService,
    useEntries: useExpenseCategoriesQuery,
    entriesKey: expenseCategoriesKey,
    countOf: companyCount,
    inUseCode: 'expense-categories.in-use',
  },
};
