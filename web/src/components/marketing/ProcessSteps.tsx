// ProcessSteps (App. D.3 "Marketing", CSPS-UI-SPEC.md §6.7), converted to utilities (D-33) with the App. D.3 props,
// markup and copy: an ordered list of steps, each with its two-digit italic numeral ("01", hidden from assistive
// technology because the list already numbers the steps), an optional bare 22px icon top right, the title and the
// description. The looks are in marketing.recipe.ts.
//
// SPEC-DEVIATION: lint no-useless-default-assignment and array-type (`steps` is required, so App. D.3's `= []` default
// never applies; `T[]` instead of `Array<T>`); same output for every typed call.
import { Icon, type IconName } from '@/components/brand';
import {
  stepClasses,
  stepDescriptionClasses,
  stepIconClasses,
  stepNumberClasses,
  stepsClasses,
  stepTitleClasses,
} from './marketing.recipe';

export interface ProcessStep {
  title: string;
  description: string;
  icon?: IconName | undefined;
}

export interface ProcessStepsProps {
  steps: ProcessStep[];
}

export function ProcessSteps({ steps }: ProcessStepsProps) {
  return (
    <ol className={stepsClasses}>
      {steps.map((s, i) => (
        <li key={i} className={stepClasses}>
          <span className={stepNumberClasses} aria-hidden="true">
            {String(i + 1).padStart(2, '0')}
          </span>
          {s.icon && (
            <span className={stepIconClasses}>
              <Icon name={s.icon} size={22} />
            </span>
          )}
          <h3 className={stepTitleClasses}>{s.title}</h3>
          <p className={stepDescriptionClasses}>{s.description}</p>
        </li>
      ))}
    </ol>
  );
}
