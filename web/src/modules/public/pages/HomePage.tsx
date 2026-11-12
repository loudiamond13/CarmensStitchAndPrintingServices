// H1 Home (UI-SPEC H1 item 1, App. E.1): the static hero text, its two buttons and the three chips. HeroArt, the hero tag
// and the data sections come with plan 11-25. "Get a Quote" goes to /contact (D-19).
import { UiLink } from '@/components/actions/UiLink';
import { Icon } from '@/components/brand/Icon';
import type { IconName } from '@/components/brand/icons';
import {
  aBtnPrimaryClasses,
  aBtnSecondaryClasses,
  btnRowClasses,
  chipClasses,
  chipIconClasses,
  chipsClasses,
  eyebrowClasses,
  h1EmClasses,
  heroClasses,
  heroCopyClasses,
  heroGridClasses,
  heroH1Classes,
  leadClasses,
} from '../components/public.recipe';
import { PUBLIC_COPY } from '../copy';
import { usePageTitle } from '../hooks/usePageTitle';

const CHIP_ICONS: readonly IconName[] = ['printer', 'shirt', 'users'];

export function HomePage() {
  usePageTitle(PUBLIC_COPY.titles.home);
  const { eyebrow, headline, lead, chips } = PUBLIC_COPY.home.hero;
  const { getQuote, viewWork } = PUBLIC_COPY.actions;
  return (
    <section className={heroClasses}>
      <div className={heroGridClasses}>
        <div className={heroCopyClasses}>
          <span className={eyebrowClasses}>{eyebrow}</span>
          <h1 className={heroH1Classes}>
            {headline.plain} <em className={h1EmClasses}>{headline.accent}</em>
          </h1>
          <p className={leadClasses}>{lead}</p>
          <div className={btnRowClasses}>
            <UiLink to="/contact" className={aBtnPrimaryClasses}>
              {getQuote}
              <Icon name="arrow-right" size={20} />
            </UiLink>
            <UiLink to="/gallery" className={aBtnSecondaryClasses}>
              {viewWork}
            </UiLink>
          </div>
          <div className={chipsClasses}>
            {chips.map((chip, index) => (
              <span key={chip} className={chipClasses}>
                <Icon name={CHIP_ICONS[index] ?? 'printer'} size={16} className={chipIconClasses} />
                {chip}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
