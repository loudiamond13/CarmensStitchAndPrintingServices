// The empty or missing value marker: an icon instead of a long dash (OR-4), read aloud as STATES_COPY.emptyValue.
import { Icon } from '@/components/brand';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { STATES_COPY } from './copy';

export interface EmptyValueProps {
  // SPEC-DEVIATION: EMPTY-LABEL. The hidden text, for a value that is missing for another reason ("Not available", D-27).
  label?: string | undefined;
}

export function EmptyValue({ label = STATES_COPY.emptyValue }: EmptyValueProps) {
  return (
    <span>
      <Icon name="minus" size={16} />
      <span className={srOnlyClasses}>{label}</span>
    </span>
  );
}
