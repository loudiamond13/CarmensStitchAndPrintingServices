// G1 Gallery (UI-SPEC G1 item 1, App. E.3): the page head with the 48px bottom padding. The filter bar, masonry and
// lightbox come with the gallery data (plan 11-29). The route sits under the lazy UrlStateLayout (WEB-10).
import { PageHead } from '../components/PageHead';
import { PUBLIC_COPY } from '../copy';
import { usePageTitle } from '../hooks/usePageTitle';

export function GalleryPage() {
  usePageTitle(PUBLIC_COPY.titles.gallery);
  const { eyebrow, headline, lead } = PUBLIC_COPY.gallery;
  return <PageHead flat crumb={PUBLIC_COPY.crumbs.gallery} eyebrow={eyebrow} headline={headline} lead={lead} />;
}
