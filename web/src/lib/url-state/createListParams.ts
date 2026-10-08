// RED placeholder (plan 02-11): the typed surface with inert setters, so the tests compile and fail on assertions.
import { useQueryStates, type Nullable, type ParserMap, type Values } from 'nuqs';

export interface ListParser {
  parse(value: string): unknown;
  serialize(value: unknown): string;
  eq(a: unknown, b: unknown): boolean;
  readonly defaultValue?: unknown;
}

export type ListParserMap = ParserMap & Record<string, ListParser>;

type FilterKey<P extends ListParserMap> = Exclude<keyof P & string, 'page' | 'q'>;
type Arg<P extends ListParserMap, K extends string> = K extends keyof P ? Values<P>[K] | null : never;

export interface ListParamsSetters<P extends ListParserMap> {
  setPage: (page: number) => void;
  setPageSize: (size: Arg<P, 'size'>) => void;
  setSearch: (text: string, options?: { immediate?: boolean }) => void;
  setFilter: <K extends FilterKey<P>>(key: K, value: Values<P>[K] | null) => void;
  setFilters: (patch: Partial<Nullable<Pick<Values<P>, FilterKey<P>>>>) => void;
  clampPage: (totalPages: number) => void;
  reset: () => void;
}

export function createListParams<P extends ListParserMap>(parsers: P) {
  return function useListParams() {
    const [values] = useQueryStates(parsers);
    const noop = (): void => undefined;
    const setters: ListParamsSetters<P> = {
      setPage: noop,
      setPageSize: noop,
      setSearch: noop,
      setFilter: noop,
      setFilters: noop,
      clampPage: noop,
      reset: noop,
    };
    return [values, setters] as const;
  };
}
