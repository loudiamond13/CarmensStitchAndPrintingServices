// SPEC-GAP: LegalFacts (UI-SPEC L1 item 3; LEGAL-04, D-11, D-12, D-13, D-29): the business name and address from the site facts, the
// Data Protection Officer line, and the contact lines. The email comes from its own read (usePrivacyContact), which only the legal
// pages make. A missing value leaves its one line out. While the reads load it shows three skeleton lines (the SkeletonText look,
// from SkeletonLines so the public chunk skips the admin money barrel); when one fails it shows the banner with Try Again and the
// rest of the page still shows. Deep imports only (PERF-01).
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { usePrivacyContact } from '../hooks/usePrivacyContact';
import { useSiteQuery } from '../hooks/useSiteQuery';
import { LEGAL_COPY } from '../legalCopy';
import type { PublicSite } from '../services/siteService';
import { addressLine, mainPhone, telHref } from '../siteFacts';
import {
  bodyClasses,
  contactLineClasses,
  contactListClasses,
  factsAddressClasses,
  factsClasses,
  inlineLinkClasses,
  labelClasses,
} from './legal.recipe';
import { ProductsError } from './ProductStates';
import { SkeletonLines } from './SkeletonLines';

const { facts: FACTS, externalSuffix } = LEGAL_COPY;

export type LegalFactsPart = 'business' | 'dpo' | 'contact';

export interface LegalFactsProps {
  /** Which parts to show, in the order of the page's text. */
  show: readonly LegalFactsPart[];
}

interface FactsDataProps {
  show: readonly LegalFactsPart[];
}

/** The business name and address; a part that is not set is left out. */
function Business({ site }: { site: PublicSite }) {
  const name = site.businessName.trim();
  const address = addressLine(site.address);
  if (name === '' && address === '') {
    return null;
  }
  return (
    <div className={factsClasses}>
      {name !== '' && <p className={labelClasses}>{name}</p>}
      {address !== '' && <p className={factsAddressClasses}>{address}</p>}
    </div>
  );
}

/** The Email, Messenger and Phone lines that have a value. */
function Contact({ site, email }: { site: PublicSite; email: string | null }) {
  const phone = mainPhone(site);
  const messenger = site.messengerUrl;
  const hasEmail = email !== null && email.trim() !== '';
  if (!hasEmail && messenger === null && phone === undefined) {
    return null;
  }
  return (
    <ul className={contactListClasses}>
      {hasEmail && (
        <li className={contactLineClasses}>
          <span>{FACTS.email}</span>
          <a className={inlineLinkClasses} href={`mailto:${email}`}>
            {email}
          </a>
        </li>
      )}
      {messenger !== null && (
        <li className={contactLineClasses}>
          <span>{FACTS.messenger}</span>
          <a className={inlineLinkClasses} href={messenger} target="_blank" rel="noopener noreferrer">
            {FACTS.messengerLink}
            <span className={srOnlyClasses}>{externalSuffix}</span>
          </a>
        </li>
      )}
      {phone !== undefined && (
        <li className={contactLineClasses}>
          <span>{FACTS.phone}</span>
          <a className={inlineLinkClasses} href={telHref(phone)}>
            {phone.display}
          </a>
        </li>
      )}
    </ul>
  );
}

function FactsData({ show }: FactsDataProps) {
  const site = useSiteQuery();
  const contact = usePrivacyContact();

  if (site.status === 'error' || contact.status === 'error') {
    const retry = () => {
      if (site.status === 'error') {
        site.retry();
      }
      if (contact.status === 'error') {
        contact.retry();
      }
    };
    return <ProductsError onRetry={retry} title={FACTS.errorTitle} />;
  }
  if (site.status === 'loading' || contact.status === 'loading') {
    return <SkeletonLines lines={3} />;
  }

  return (
    <>
      {show.map((part) => {
        if (part === 'business') {
          return <Business key={part} site={site.data} />;
        }
        if (part === 'dpo') {
          return (
            <p key={part} className={bodyClasses}>
              {FACTS.dpo}
            </p>
          );
        }
        return <Contact key={part} site={site.data} email={contact.data.email} />;
      })}
    </>
  );
}

export function LegalFacts({ show }: LegalFactsProps) {
  const needsData = show.includes('business') || show.includes('contact');
  if (!needsData) {
    return <p className={bodyClasses}>{FACTS.dpo}</p>;
  }
  return (
    <div className={factsClasses}>
      <FactsData show={show} />
    </div>
  );
}
