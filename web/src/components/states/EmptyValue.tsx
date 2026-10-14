// The empty or missing value marker: an icon instead of a long dash (OR-4), read aloud as STATES_COPY.emptyValue.
import { Icon } from '@/components/brand';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { STATES_COPY } from './copy';

export function EmptyValue() {
  return (
    <span>
      <Icon name="minus" size={16} />
      <span className={srOnlyClasses}>{STATES_COPY.emptyValue}</span>
    </span>
  );
}
