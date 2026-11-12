// AnchorPills (UI-SPEC P1 item 2, D-32): the sticky bar of one 44px pill link per shown line, each to #key. A key that fails
// the allow-list gets no pill (T-11-44), and with no pill at all there is no bar. The row scrolls inside itself, so the page
// never scrolls sideways at 320px.
import { UiLink } from '@/components/actions/UiLink';
import { PUBLIC_COPY } from '../copy';
import { isLineKey } from '../lineKey';
import type { PublicProductLine } from '../services/contentService';
import { anchorsClasses, anchorsInClasses, pillClasses } from './products.recipe';

export interface AnchorPillsProps {
  lines: readonly PublicProductLine[];
}

export function AnchorPills({ lines }: AnchorPillsProps) {
  const shown = lines.filter((line) => isLineKey(line.key));
  if (shown.length === 0) {
    return null;
  }
  return (
    <div className={anchorsClasses} data-products-bar="">
      <nav aria-label={PUBLIC_COPY.products.pillNav} className={anchorsInClasses}>
        {shown.map((line) => (
          <UiLink key={line.key} to={`#${line.key}`} className={pillClasses}>
            {line.title}
          </UiLink>
        ))}
      </nav>
    </div>
  );
}
