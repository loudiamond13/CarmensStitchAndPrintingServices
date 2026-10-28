// SPEC-GAP: PublicLayoutCheckPage. Dev builds only (D-20): a column of labelled fields inside the real PublicLayout, so the e2e focus checks can
// reach the sticky site header before the public pages return in Phase 11.
import { useEffect } from 'react';
import { Field } from '@/components/forms/Field';
import { pageTitleClasses } from '@/components/layout/layout.recipe';
import { tw } from '@/ui/tw';

const FIELD_COUNT = 16;
const FIELD_NUMBERS = Array.from({ length: FIELD_COUNT }, (_, index) => index + 1);

const columnClasses = tw('mx-auto flex w-full max-w-[480px] flex-col gap-4 px-4 py-8');

export function PublicLayoutCheckPage() {
  useEffect(() => {
    document.title = 'Public layout check';
  }, []);
  return (
    <div className={columnClasses}>
      <h1 className={pageTitleClasses}>Public layout check</h1>
      {FIELD_NUMBERS.map((number) => (
        <Field key={number} label={`Field ${String(number)}`} />
      ))}
    </div>
  );
}
