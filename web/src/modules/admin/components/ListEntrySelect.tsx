// ListEntrySelect (plan 08-04). Skeleton for the red step.
import { Select } from '@/components/forms';

export type ListEntrySelectProps =
  | { list: 'product-types'; mode: 'filter'; value: string | null; onChange: (id: string | null) => void }
  | {
      list: 'product-types';
      mode: 'picker';
      value: string;
      onChange: (id: string) => void;
      savedEntry?: string | null | undefined;
      error?: string | undefined;
    };

export function ListEntrySelect(props: ListEntrySelectProps) {
  void props;
  return <Select label="Product type" options={[]} />;
}
