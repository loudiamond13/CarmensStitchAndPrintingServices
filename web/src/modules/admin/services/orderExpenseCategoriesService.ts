// Skeleton for the red step (plan 08-04).
import type { HttpClient } from '@/core/api/apiClient';
import type { ProductTypesService } from './productTypesService';

export type OrderExpenseCategoriesService = ProductTypesService;

const notBuilt = (): never => {
  throw new Error('not built');
};

export function createOrderExpenseCategoriesService(client: HttpClient): OrderExpenseCategoriesService {
  void client;
  return {
    list: notBuilt,
    create: notBuilt,
    get: notBuilt,
    update: notBuilt,
    retire: notBuilt,
    reactivate: notBuilt,
    remove: notBuilt,
  };
}
