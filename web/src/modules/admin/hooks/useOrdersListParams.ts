// The Orders list's URL state (plan 08-06).
import { createListParams } from '@/lib/url-state/createListParams';
import { pageParser } from '@/lib/url-state/parsers';

export const useOrdersListParams = createListParams({ page: pageParser });
