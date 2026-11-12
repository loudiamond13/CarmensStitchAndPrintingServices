// SPEC-GAP: not found page. N1 (UI-SPEC N1): the page head with eyebrow "Error 404", the h1, the lead and two buttons.
// The server answers 404 for the same paths (plan 11-02). The path is never shown on the page (T-11-17).
import { UiLink } from '@/components/actions/UiLink';
import { Icon } from '@/components/brand/Icon';
import { PageHead } from '../components/PageHead';
import { aBtnPrimaryClasses, aBtnSecondaryClasses } from '../components/public.recipe';
import { PUBLIC_COPY } from '../copy';
import { usePageTitle } from '../hooks/usePageTitle';

export function NotFoundPage() {
  usePageTitle(PUBLIC_COPY.titles.notFound);
  const { eyebrow, headline, lead, home, work } = PUBLIC_COPY.notFound;
  return (
    <PageHead
      flat
      eyebrow={eyebrow}
      headline={headline}
      lead={lead}
      actions={
        <>
          <UiLink to="/" className={aBtnPrimaryClasses}>
            {home}
            <Icon name="arrow-right" size={20} />
          </UiLink>
          <UiLink to="/gallery" className={aBtnSecondaryClasses}>
            {work}
          </UiLink>
        </>
      }
    />
  );
}
