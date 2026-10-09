// TestimonialCard (App. D.3 "Marketing", CSPS-UI-SPEC.md §6.7), converted to utilities (D-33) with the App. D.3 props,
// markup and copy: a figure with five 16px stars (filled up to the rating in `--accent-ink`, the rest in
// `--line-strong`), the quote in curly quote marks, and a figcaption with the 40px avatar, the name and the team. The
// looks are in marketing.recipe.ts.
//
// SPEC-DEVIATION: D-31 O-2 (owner, 2026-10-08) the star rating `<div aria-label>` gets the img role, so its label
// ("5 out of 5", App. D.3's wording) is a valid name for one image; no visible change.
// SPEC-DEVIATION: lint restrict-plus-operands (the label is a template with String()); same text.
import clsx from 'clsx';
import { Icon } from '@/ui/brand';
import { Avatar } from '@/ui/status';
import {
  bylineClasses,
  bylineNameClasses,
  bylineTeamClasses,
  quoteClasses,
  starOnClasses,
  starsClasses,
  testimonialClasses,
} from './marketing.recipe';

export interface TestimonialCardProps {
  quote: string;
  name: string;
  team: string;
  rating?: number | undefined;
}

export function TestimonialCard({ quote, name, team, rating = 5 }: TestimonialCardProps) {
  return (
    <figure className={testimonialClasses}>
      <div className={starsClasses} role="img" aria-label={`${String(rating)} out of 5`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Icon key={i} name="star" size={16} className={clsx(i <= rating && starOnClasses)} />
        ))}
      </div>
      <blockquote className={quoteClasses}>{quote}</blockquote>
      <figcaption className={bylineClasses}>
        <Avatar name={name} size={40} />
        <span>
          <strong className={bylineNameClasses}>{name}</strong>
          <span className={bylineTeamClasses}>{team}</span>
        </span>
      </figcaption>
    </figure>
  );
}
