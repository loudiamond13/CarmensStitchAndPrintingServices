// CategoryGrid (UI-SPEC H1 item 2, App. E.1; PUB-02, D-34): "What we make", one CategoryCard per shown product line in
// display order. Each card shows the line's title, card text and number, its Main photo when it has one, and links to its
// place on Products. A line key is checked before it becomes an address (T-11-63); an odd key sends the card to /products.
import { UiLink } from '@/components/actions/UiLink';
import { Icon } from '@/components/brand/Icon';
import { CategoryCard } from '@/components/marketing/CategoryCard';
import { PUBLIC_COPY } from '../copy';
import { isLineKey } from '../lineKey';
import type { PublicHomeLine } from '../services/contentService';
import {
  catsClasses,
  cutClasses,
  h2Classes,
  h2EmClasses,
  headInRowClasses,
  headRowClasses,
  homeWrapClasses,
} from './home.recipe';
import { eyebrowClasses, leadClasses, linkClasses } from './public.recipe';

const { categories: COPY } = PUBLIC_COPY.home;

// UI-SPEC "Image delivery slots": the category card.
const CARD_SIZES =
  '(max-width: 767px) calc(50vw - 22px), (max-width: 1023px) calc(50vw - 36px), min(368px, calc(33.3333vw - 32px))';

export interface CategoryGridProps {
  lines: readonly PublicHomeLine[];
}

function cardPhoto(line: PublicHomeLine) {
  const photo = line.cardPhoto;
  return photo === null
    ? undefined
    : {
        src: photo.src,
        srcSet: photo.srcSet,
        sizes: CARD_SIZES,
        width: Number(photo.width),
        height: Number(photo.height),
      };
}

export function CategoryGrid({ lines }: CategoryGridProps) {
  return (
    <section className={cutClasses}>
      <div className={homeWrapClasses}>
        <div className={headRowClasses}>
          <div className={headInRowClasses}>
            <span className={eyebrowClasses}>{COPY.eyebrow}</span>
            <h2 className={h2Classes}>
              {`${COPY.headline.plain} `}
              <em className={h2EmClasses}>{COPY.headline.accent}</em>
            </h2>
            <p className={leadClasses}>{COPY.lead(lines.length)}</p>
          </div>
          <UiLink to="/products" className={linkClasses}>
            {COPY.allProducts}
            <Icon name="arrow-right" size={18} />
          </UiLink>
        </div>
        <div className={catsClasses}>
          {lines.map((line) => (
            <CategoryCard
              key={line.key}
              title={line.title}
              description={line.cardText}
              number={line.number}
              photo={cardPhoto(line)}
              href={isLineKey(line.key) ? `/products#${line.key}` : '/products'}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
