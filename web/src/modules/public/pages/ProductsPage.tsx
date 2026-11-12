// P1 Products (UI-SPEC P1, App. E.2; PUB-01, PUB-02, CONT-02, D-19, D-32): the page head with the count of lines in words,
// the sticky pill bar, one article per shown line in display order and the help card. The lines come from the productLines
// boot block on a first visit and from the API after that.
// States: loading shows six pill skeletons and two article skeletons in one loading region; a failed read shows the error
// with Try Again in their place; no shown line shows the empty state and no pill bar. The help card stays in all of them.
// Hash on load: once the articles are on screen, an address like /products#polo scrolls to that article (instantly under
// prefers-reduced-motion, smoothly otherwise) and moves no focus. A hash that matches no article does nothing.
import { Suspense, useRef } from 'react';
import { useLocation, useOutletContext } from 'react-router';

import { AnchorPills } from '../components/AnchorPills';
import { LazyProductList, LazyProductsEmpty, LazyProductsHelp } from '../components/lazyProducts';
import { PageHead } from '../components/PageHead';
import { ArticleSkeletons, PillSkeletons } from '../components/ProductSkeletons';
import { ProductsError, ProductsLoadingRegion } from '../components/ProductStates';
import { prodWrapClasses, stateWrapClasses } from '../components/products.recipe';
import { PUBLIC_COPY } from '../copy';
import { usePageTitle } from '../hooks/usePageTitle';
import { useProductLinesQuery } from '../hooks/useProductLinesQuery';
import { isLineKey } from '../lineKey';
import type { PublicOutletContext } from '../outletContext';

export function ProductsPage() {
  usePageTitle(PUBLIC_COPY.titles.products);
  const { eyebrow, headline, lead } = PUBLIC_COPY.products;
  const query = useProductLinesQuery();
  const { hash } = useLocation();
  const context = useOutletContext<PublicOutletContext | undefined>();
  const messengerUrl = context?.messengerUrl ?? null;
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
    const go = () => {
      target.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' });
    };
    // The display font swaps in after the first paint and re-wraps the titles above, which moves the article by about 100px
    // while a smooth scroll is on its way (seen in Firefox). Scrolling once the fonts are ready lands in the right place.
    if ('fonts' in document) {
      void document.fonts.ready.then(go);
    } else {
      go();
    }
  }

  return (
    <>
      <PageHead
        crumb={PUBLIC_COPY.crumbs.products}
        eyebrow={eyebrow}
        headline={headline}
        lead={lines === undefined || lines.length === 0 ? undefined : lead(lines.length)}
      />
      {query.status === 'error' ? (
        <div className={stateWrapClasses}>
          <ProductsError onRetry={query.retry} />
        </div>
      ) : (
        <ProductsLoadingRegion loading={query.status === 'loading'}>
          {lines === undefined ? (
            <>
              <PillSkeletons />
              <ArticleSkeletons />
            </>
          ) : lines.length === 0 ? (
            <Suspense fallback={null}>
              <LazyProductsEmpty messengerUrl={messengerUrl} />
            </Suspense>
          ) : (
            <>
              <AnchorPills lines={lines} />
              <div className={prodWrapClasses}>
                <Suspense fallback={<ArticleSkeletons />}>
                  <LazyProductList lines={lines} onShown={scrollToHash} />
                </Suspense>
              </div>
            </>
          )}
        </ProductsLoadingRegion>
      )}
      <Suspense fallback={null}>
        <LazyProductsHelp />
      </Suspense>
    </>
  );
}
