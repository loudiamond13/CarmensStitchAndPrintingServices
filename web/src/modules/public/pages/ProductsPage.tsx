// P1 Products (UI-SPEC P1 item 1, App. E.2): the page head. The anchor pills, product articles and help card come with
// the product data (plan 11-18); the count-in-words lead comes with them, so this head has none yet.
import { PageHead } from '../components/PageHead';
import { PUBLIC_COPY } from '../copy';
import { usePageTitle } from '../hooks/usePageTitle';

export function ProductsPage() {
  usePageTitle(PUBLIC_COPY.titles.products);
  const { eyebrow, headline } = PUBLIC_COPY.products;
  return <PageHead crumb={PUBLIC_COPY.crumbs.products} eyebrow={eyebrow} headline={headline} />;
}
