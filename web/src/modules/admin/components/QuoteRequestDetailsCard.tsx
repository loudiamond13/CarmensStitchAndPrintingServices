// SPEC-GAP: quote request details card (UI-SPEC R2 item 2). What the visitor sent, as a list of terms and values. Every value is
// React text, never HTML (CWE-79), and an empty one is EmptyValue.
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { UiLink } from '@/components/actions';
import { EmptyValue } from '@/components/states';
import {
  orderCardBodyClasses,
  orderCardClasses,
  orderCardHeadClasses,
  orderCardTitleClasses,
} from '@/modules/admin/components/orderPage.recipe';
import {
  quoteContactLinkClasses,
  quoteDetailsListClasses,
  quoteMessageClasses,
  quoteTermClasses,
  quoteValueClasses,
} from '@/modules/admin/components/quoteRequests.recipe';
import { QUOTE_REQUEST_COPY, QUOTE_REQUESTS_COPY } from '@/modules/admin/quoteRequestsCopy';
import type { QuoteRequestDetailResponse } from '@/modules/admin/services/quoteRequestsService';

const COPY = QUOTE_REQUEST_COPY.details;
const TITLE_ID = 'quote-request-details';

function filled(value: string | null): value is string {
  return value !== null && value.trim() !== '';
}

function productText(request: QuoteRequestDetailResponse): string | null {
  const product = request.product;
  if (product === null) return null;
  if (product.choice === 'custom') return QUOTE_REQUESTS_COPY.product.custom;
  if (product.choice === 'not-sure') return QUOTE_REQUESTS_COPY.product.notSure;
  return product.title;
}

/** The dial target: the digits of the server's display number, with a leading + kept. */
function telHref(number: string): string {
  return `tel:${number.replace(/[^\d+]/g, '')}`;
}

/** The mail target, with the characters RFC 6068 reserves encoded, so the address cannot add a Cc or a subject. */
function mailtoHref(email: string): string {
  return `mailto:${email.replace(/[%?#&]/g, (c) => encodeURIComponent(c))}`;
}

function Row({ term, children, message = false }: { term: string; children: ReactNode; message?: boolean }) {
  return (
    <div>
      <dt className={quoteTermClasses}>{term}</dt>
      <dd className={clsx(quoteValueClasses, message && quoteMessageClasses)}>{children}</dd>
    </div>
  );
}

export function QuoteRequestDetailsCard({ request }: { request: QuoteRequestDetailResponse }) {
  const product = productText(request);
  return (
    <section className={orderCardClasses} aria-labelledby={TITLE_ID}>
      <div className={orderCardHeadClasses}>
        <h2 id={TITLE_ID} className={orderCardTitleClasses}>
          {COPY.title}
        </h2>
      </div>
      <div className={orderCardBodyClasses}>
        <dl className={quoteDetailsListClasses}>
          <Row term={COPY.team}>{filled(request.teamName) ? request.teamName : <EmptyValue />}</Row>
          <Row term={COPY.phone}>
            {filled(request.contactNumber) ? (
              <UiLink to={telHref(request.contactNumber)} className={quoteContactLinkClasses}>
                {request.contactNumber}
              </UiLink>
            ) : (
              <EmptyValue />
            )}
          </Row>
          <Row term={COPY.email}>
            {filled(request.email) ? (
              <UiLink to={mailtoHref(request.email)} className={quoteContactLinkClasses}>
                {request.email}
              </UiLink>
            ) : (
              <EmptyValue />
            )}
          </Row>
          <Row term={COPY.product}>{filled(product) ? product : <EmptyValue />}</Row>
          <Row term={COPY.quantity}>
            {filled(request.quantity) ? QUOTE_REQUESTS_COPY.pieces(request.quantity) : <EmptyValue />}
          </Row>
          <Row term={COPY.message} message>
            {filled(request.message) ? request.message : <EmptyValue />}
          </Row>
        </dl>
      </div>
    </section>
  );
}
