// RED placeholder (02-08 Task 1): reads the URL but never normalizes it; replaced in GREEN.
import { useQueryStates, type UrlKeys, type UseQueryStatesKeysMap } from 'nuqs';

export function createListParams<P extends UseQueryStatesKeysMap>(parsers: P, options: { urlKeys?: UrlKeys<P> } = {}) {
  const hookOptions = { urlKeys: options.urlKeys ?? {} };
  return function useListParams() {
    return useQueryStates(parsers, hookOptions);
  };
}
