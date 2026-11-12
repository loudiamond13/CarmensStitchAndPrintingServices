// P1 Products (UI-SPEC P1, App. E.2; PUB-01, PUB-02, D-19, D-32): the page head with the count of lines in words, the sticky
// pill bar, one article per shown line in display order and the help card. The lines come from the productLines boot block
// on a first visit and from the API after that.
// Hash on load: once the articles are on screen, an address like /products#polo scrolls to that article (instantly under
// prefers-reduced-motion, smoothly otherwise) and moves no focus. A hash that matches no article does nothing.
import { Suspense, useRef } from 'react';
import { useLocation } from 'react-router';
import { AnchorPills } from '../components/AnchorPills';
import { LazyProductList, LazyProductsHelp } from '../components/lazyProducts';
import { PageHead } from '../components/PageHead';
import { prodWrapClasses } from '../components/products.recipe';
import { PUBLIC_COPY } from '../copy';
import { usePageTitle } from '../hooks/usePageTitle';
import { useProductLinesQuery } from '../hooks/useProductLinesQuery';
import { isLineKey } from '../lineKey';

export function ProductsPage() {
  usePageTitle(PUBLIC_COPY.titles.products);
  const { eyebrow, headline, lead } = PUBLIC_COPY.products;
  const query = useProductLinesQuery();
  const { hash } = useLocation();
  const scrolled = useRef(false);
  const lines = query.status === 'success' ? query.data.lines : undefined;

  function scrollToHash(): void {
    const key = hash.slice(1);
    const target = scrolled.current || !isLineKey(key) ? null : document.getElementById(key);
    if (target === null) {
      return;
    }
    scrolled.current = true;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' });
  }

  return (
    <>
      <PageHead
        crumb={PUBLIC_COPY.crumbs.products}
        eyebrow={eyebrow}
        headline={headline}
        lead={lines === undefined || lines.length === 0 ? undefined : lead(lines.length)}
      />
      {lines !== undefined && <AnchorPills lines={lines} />}
      {lines !== undefined && (
        <div className={prodWrapClasses}>
          <Suspense fallback={null}>
            <LazyProductList lines={lines} onShown={scrollToHash} />
          </Suspense>
        </div>
      )}
      <Suspense fallback={null}>
        <LazyProductsHelp />
      </Suspense>
    </>
  );
}
