// CategoryCard (App. D.3 "Marketing", CSPS-UI-SPEC.md §6.7), converted to utilities (D-33) with the App. D.3 props,
// markup and copy: the whole card is one link (UiLink, so in-app paths route client-side) with the 4:5 media (the
// photo, or a placeholder with the big outlined number), the display title, the description and "Customize" with
// `arrow-up-right`. The looks are in marketing.recipe.ts. The phone look (description hidden, 20px title, spec §6.7)
// belongs to the home page's `.s-cats` grid, which the public-site phase builds.
//
// SPEC-DEVIATION: D-33 the placeholder is MediaPlaceholder `label={false}` (the App. B `.csp-cat-media
// .csp-media-ph-label { display: none }` parent rule as a prop, plan 02-18); it is named "No image yet", and the
// link keeps the title, the description and "Customize" in its name.
// SPEC-DEVIATION: exactOptionalPropertyTypes; the optional props also accept an explicit undefined (same output).
import { UiLink } from '@/components/actions';
import { Icon, MediaPlaceholder } from '@/components/brand';
import {
  categoryBodyClasses,
  categoryCardClasses,
  categoryDescriptionClasses,
  categoryImageClasses,
  categoryLinkClasses,
  categoryLinkIconClasses,
  categoryMediaClasses,
  categoryPlaceholderClasses,
  categoryTitleClasses,
} from './marketing.recipe';

export interface CategoryCardProps {
  title: string;
  description: string;
  number?: string | undefined;
  image?: string | undefined;
  href?: string | undefined;
}

export function CategoryCard({ title, description, number, image, href = '/products' }: CategoryCardProps) {
  return (
    <UiLink to={href} className={categoryCardClasses}>
      <div className={categoryMediaClasses}>
        {image ? (
          <img src={image} alt="" className={categoryImageClasses} />
        ) : (
          <MediaPlaceholder label={false} number={number} ratio="4 / 5" className={categoryPlaceholderClasses} />
        )}
      </div>
      <div className={categoryBodyClasses}>
        <h3 className={categoryTitleClasses}>{title}</h3>
        <p className={categoryDescriptionClasses}>{description}</p>
        <span className={categoryLinkClasses}>
          Customize
          <Icon name="arrow-up-right" size={18} className={categoryLinkIconClasses} />
        </span>
      </div>
    </UiLink>
  );
}
