// The inner-page head (App. E.2 `section.s-pagehead.s-mesh`; UI-SPEC Component Inventory): optional breadcrumb, eyebrow,
// the one h1 with its accent word, an optional lead and an optional button row. `flat` is the 48px bottom padding of the
// Gallery, Contact and 404 pages. Deep imports only (PERF-01).
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { UiLink } from '@/components/actions/UiLink';
import { PUBLIC_COPY } from '../copy';
import {
  btnRowClasses,
  crumbLinkClasses,
  crumbsClasses,
  eyebrowClasses,
  h1EmClasses,
  leadClasses,
  pageH1Classes,
  pageHeadBottomClasses,
  pageHeadClasses,
  pageHeadFlatBottomClasses,
  pageHeadWrapClasses,
} from './public.recipe';

export interface PageHeadProps {
  eyebrow: string;
  /** The h1: `plain` then `accent`, which sits in the em. */
  headline: { readonly plain: string; readonly accent: string };
  /** The current page's name; with it, a "Home / {crumb}" breadcrumb shows above the eyebrow. */
  crumb?: string;
  lead?: string | undefined;
  /** The buttons under the lead. */
  actions?: ReactNode;
  /** Bottom padding 48px instead of 48px plus the cut angle. */
  flat?: boolean;
}

export function PageHead({ eyebrow, headline, crumb, lead, actions, flat = false }: PageHeadProps) {
  return (
    <section className={clsx(pageHeadClasses, flat ? pageHeadFlatBottomClasses : pageHeadBottomClasses)}>
      <div className={pageHeadWrapClasses}>
        {crumb !== undefined && (
          <nav className={crumbsClasses} aria-label={PUBLIC_COPY.crumbs.label}>
            <UiLink to="/" className={crumbLinkClasses}>
              {PUBLIC_COPY.crumbs.home}
            </UiLink>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{crumb}</span>
          </nav>
        )}
        <span className={eyebrowClasses}>{eyebrow}</span>
        {/* The plain part and its space are one text node, as App. E.2 writes it: a separate space node shapes 0.01 px wider in Chromium. */}
        <h1 className={pageH1Classes}>
          {`${headline.plain} `}
          <em className={h1EmClasses}>{headline.accent}</em>
        </h1>
        {lead !== undefined && <p className={leadClasses}>{lead}</p>}
        {actions !== undefined && <div className={btnRowClasses}>{actions}</div>}
      </div>
    </section>
  );
}
