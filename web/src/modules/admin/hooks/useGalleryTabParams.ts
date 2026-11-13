// The Gallery tab's URL state (WEB-10, GAL-03, T-11-81; plan 11-32). Not built yet.
import { createListParams } from '@/lib/url-state/createListParams';
import { guidParser, pageParser, pageSizeParser } from '@/lib/url-state/parsers';

const useGalleryUrlParams = createListParams({ line: guidParser, page: pageParser, size: pageSizeParser });

export function useGalleryTabParams(_lineIds: readonly string[] | undefined) {
  return useGalleryUrlParams();
}
