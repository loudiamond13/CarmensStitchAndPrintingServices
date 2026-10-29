// Skeleton for the red step (plan 08-04).
import type { HttpClient } from '@/core/api/apiClient';
import type { ProductTypesService } from './productTypesService';

export type PaymentMethodsService = ProductTypesService;

const notBuilt = (): never => {
  throw new Error('not built');
};

export function createPaymentMethodsService(client: HttpClient): PaymentMethodsService {
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
