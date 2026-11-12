// WhyCsps (UI-SPEC H1 item 3, App. E.1, D-36): "Why CSPS" with four fixed cards and the Fast turnaround card. That card shows
// the Business Info turnaround line exactly as the Manager typed it. With no line it shows a text that promises no time, so
// the page never makes a turnaround promise the Manager did not write.
import { Icon } from '@/components/brand/Icon';
import { PUBLIC_COPY } from '../copy';
import {
  h2Classes,
  h2EmClasses,
  headClasses,
  homeWrapClasses,
  secClasses,
  whyBodyClasses,
  whyGridClasses,
  whyIconClasses,
  whyItemClasses,
  whyTextClasses,
  whyTitleClasses,
} from './home.recipe';
import { eyebrowClasses } from './public.recipe';

const { why: COPY } = PUBLIC_COPY.home;

export interface WhyCspsProps {
  /** The Business Info turnaround line; null or blank shows the no-promise fallback. */
  turnaroundLine: string | null;
}

export function WhyCsps({ turnaroundLine }: WhyCspsProps) {
  const typed = turnaroundLine !== null && turnaroundLine.trim() !== '';
  const cards = [
    ...COPY.items,
    {
      icon: COPY.turnaround.icon,
      title: COPY.turnaround.title,
      text: typed ? turnaroundLine : COPY.turnaround.fallback,
    },
  ];
  return (
    <section className={secClasses}>
      <div className={homeWrapClasses}>
        <div className={headClasses}>
          <span className={eyebrowClasses}>{COPY.eyebrow}</span>
          <h2 className={h2Classes}>
            {`${COPY.headline.plain} `}
            <em className={h2EmClasses}>{COPY.headline.accent}</em>
            {` ${COPY.headline.rest}`}
          </h2>
        </div>
        <div className={whyGridClasses}>
          {cards.map((card) => (
            <div key={card.title} className={whyItemClasses}>
              <span className={whyIconClasses}>
                <Icon name={card.icon} size={22} />
              </span>
              <div className={whyTextClasses}>
                <h3 className={whyTitleClasses}>{card.title}</h3>
                <p className={whyBodyClasses}>{card.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
