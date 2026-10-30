import { z } from 'zod';

export const blankOrderItem = () => ({});
export const orderItemSchema = z.any();
export const orderDetailsSchema = z.any();
export const createOrderSchema = z.any();
export const toCreateOrderRequest = (values: unknown) => values;
export type OrderItemFormInput = Record<string, string>;
export type CreateOrderFormInput = Record<string, unknown>;
