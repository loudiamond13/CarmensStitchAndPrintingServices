// ProductArticle (UI-SPEC P1 item 3, D-07): one product line. The id is the line key and the h2 names the article. The media
// comes first (and stays first in one column), the copy has the number, title, description, the five fixed customize cards
// and the price line. Even articles (the second, fourth, ...) put the media on the right on wide screens.
import clsx from 'clsx';
import { UiLink } from '@/components/actions/UiLink';
import { Icon } from '@/components/brand/Icon';
import type { IconName } from '@/components/brand/icons';
import { PUBLIC_COPY } from '../copy';
import { isLineKey } from '../lineKey';
import type { PublicProductLine } from '../services/contentService';
import { PriceLine } from './PriceLine';
import { ProductMedia } from './ProductMedia';
import {
  articleButtonsClasses,
  articleClasses,
  articleTitleClasses,
  copyClasses,
  customCardClasses,
  customCardWideClasses,
  customizeEyebrowClasses,
  customGridClasses,
  customIconClasses,
  customTextClasses,
  customTitleClasses,
  flipMediaClasses,
  numberClasses,
} from './products.recipe';
import { aBtnPrimaryClasses, aBtnSecondaryClasses, eyebrowClasses, leadClasses } from './public.recipe';

const { article: COPY } = PUBLIC_COPY.products;

// D-07: the cards, always in this order with these icons; the last one is wide.
const CARD_ICONS: readonly IconName[] = ['layout-grid', 'shirt', 'ruler', 'zap', 'palette'];

/** "1" as "01". */
function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

export interface ProductArticleProps {
  line: PublicProductLine;
  /** Zero-based position among the shown lines. */
  index: number;
  /** How many lines are shown. */
  total: number;
}

export function ProductArticle({ line, index, total }: ProductArticleProps) {
  // A key reaches an element id only when it passes the allow-list (T-11-44); otherwise the place names the title.
  const safeKey = isLineKey(line.key) ? line.key : undefined;
  const titleId = safeKey === undefined ? `product-line-${String(index + 1)}-title` : `${safeKey}-title`;
  const flip = index % 2 === 1;
  const texts = [
    line.customize.fabric,
    line.customize.collar,
    line.customize.cut,
    line.customize.names,
    line.customize.logos,
  ];
  return (
    <article id={safeKey} aria-labelledby={titleId} data-flip={flip ? 'true' : undefined} className={articleClasses}>
      <ProductMedia line={line} className={flip ? flipMediaClasses : undefined} />
      <div className={copyClasses}>
        <span className={numberClasses} aria-hidden="true">
          {`${twoDigits(index + 1)} / ${twoDigits(total)}`}
        </span>
        <h2 id={titleId} className={articleTitleClasses}>
          {line.title}
        </h2>
        <p className={leadClasses}>{line.description}</p>
        <h3 className={clsx(eyebrowClasses, customizeEyebrowClasses)}>{COPY.customize}</h3>
        <div className={customGridClasses}>
          {COPY.cards.map((title, position) => (
            <div
              key={title}
              className={clsx(customCardClasses, position === COPY.cards.length - 1 && customCardWideClasses)}
            >
              <h4 className={customTitleClasses}>
                <Icon name={CARD_ICONS[position] ?? 'layout-grid'} size={18} className={customIconClasses} />
                {title}
              </h4>
              <p className={customTextClasses}>{texts[position]}</p>
            </div>
          ))}
        </div>
        <PriceLine price={line.startsAtPrice} minimum={line.minimumQuantity} />
        <div className={articleButtonsClasses}>
          <UiLink to="/contact" className={aBtnPrimaryClasses}>
            {PUBLIC_COPY.actions.getQuote}
            <Icon name="arrow-right" size={20} />
          </UiLink>
          {line.hasGalleryItems && isLineKey(line.key) && (
            <UiLink to={`/gallery?category=${line.key}`} className={aBtnSecondaryClasses}>
              {COPY.seeWork(line.shortName)}
            </UiLink>
          )}
        </div>
      </div>
    </article>
  );
}
