// C1 Contact (UI-SPEC C1 item 1, App. E.4, D-18): the page head with the 48px bottom padding and the contact-first lead.
// The Message us card, the aside and the sticky bar come with the site data (plan 11-10).
import { PageHead } from '../components/PageHead';
import { PUBLIC_COPY } from '../copy';
import { usePageTitle } from '../hooks/usePageTitle';

export function ContactPage() {
  usePageTitle(PUBLIC_COPY.titles.contact);
  const { eyebrow, headline, lead } = PUBLIC_COPY.contact;
  return <PageHead flat crumb={PUBLIC_COPY.crumbs.contact} eyebrow={eyebrow} headline={headline} lead={lead} />;
}
