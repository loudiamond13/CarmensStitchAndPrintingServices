// HowOrdering (UI-SPEC H1 item 4, App. E.1): "How ordering works", the four approved steps as the shared ProcessSteps list on
// the mesh band. The words are fixed.
import clsx from 'clsx';
import { ProcessSteps } from '@/components/marketing/ProcessSteps';
import { PUBLIC_COPY } from '../copy';
import { cutClasses, cutMeshClasses, h2Classes, h2EmClasses, headClasses, homeWrapClasses } from './home.recipe';
import { eyebrowClasses } from './public.recipe';

const { steps: COPY } = PUBLIC_COPY.home;

const STEPS = COPY.items.map((step) => ({ icon: step.icon, title: step.title, description: step.text }));

export function HowOrdering() {
  return (
    <section className={clsx(cutClasses, cutMeshClasses)}>
      <div className={homeWrapClasses}>
        <div className={headClasses}>
          <span className={eyebrowClasses}>{COPY.eyebrow}</span>
          <h2 className={h2Classes}>
            {`${COPY.headline.plain} `}
            <em className={h2EmClasses}>{COPY.headline.accent}</em>
          </h2>
        </div>
        <ProcessSteps steps={STEPS} />
      </div>
    </section>
  );
}
