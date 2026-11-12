// P1 Products (UI-SPEC P1, App. E.2; PUB-01, PUB-02): the page head with the count of lines in words, then one article per
// shown line in display order. The lines come from the productLines boot block on a first visit and from the API after that.
import { Suspense } from 'react';
import { LazyProductList } from '../components/lazyProducts';
import { PageHead } from '../components/PageHead';
import { prodWrapClasses } from '../components/products.recipe';
import { PUBLIC_COPY } from '../copy';
import { usePageTitle } from '../hooks/usePageTitle';
import { useProductLinesQuery } from '../hooks/useProductLinesQuery';

export function ProductsPage() {
  usePageTitle(PUBLIC_COPY.titles.products);
  const { eyebrow, headline, lead } = PUBLIC_COPY.products;
  const query = useProductLinesQuery();
  const lines = query.status === 'success' ? query.data.lines : undefined;
  return (
    <>
      <PageHead
        crumb={PUBLIC_COPY.crumbs.products}
        eyebrow={eyebrow}
        headline={headline}
        lead={lines === undefined || lines.length === 0 ? undefined : lead(lines.length)}
      />
      {lines !== undefined && (
        <div className={prodWrapClasses}>
          <Suspense fallback={null}>
            <LazyProductList lines={lines} />
          </Suspense>
        </div>
      )}
    </>
  );
}
