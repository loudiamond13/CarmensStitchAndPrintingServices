// RED placeholder (02-39 Task 1): no shared defaults yet.
import { QueryClient, type DefaultOptions } from '@tanstack/react-query';

export const QUERY_DEFAULTS = {} satisfies DefaultOptions;

export function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: QUERY_DEFAULTS });
}
