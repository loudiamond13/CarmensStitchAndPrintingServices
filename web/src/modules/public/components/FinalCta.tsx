// FinalCta (UI-SPEC H1 item 7, App. E.1; D-19, PUB-06): the orange band with the last "Get a Quote" to /contact and, when the
// shop has a Messenger link, "Message us on Messenger" to it (App. E.1 pointed that button at Contact).
import { UiLink } from '@/components/actions/UiLink';
import { Icon } from '@/components/brand/Icon';
import { PUBLIC_COPY } from '../copy';
import { ctaClasses, ctaHeadingClasses, ctaLeadClasses, ctaTextClasses, ctaWrapClasses } from './home.recipe';
import { aBtnDarkClasses, aBtnGhostClasses, btnRowClasses } from './public.recipe';

const { cta: COPY } = PUBLIC_COPY.home;

export interface FinalCtaProps {
  /** The Messenger link, or null when the shop has none. */
  messengerUrl: string | null;
}

export function FinalCta({ messengerUrl }: FinalCtaProps) {
  return (
    <section className={ctaClasses}>
      <div className={ctaWrapClasses}>
        <div className={ctaTextClasses}>
          <h2 className={ctaHeadingClasses}>{COPY.headline}</h2>
          <p className={ctaLeadClasses}>{COPY.lead}</p>
        </div>
        <div className={btnRowClasses}>
          <UiLink to="/contact" className={aBtnDarkClasses}>
            {PUBLIC_COPY.actions.getQuote}
            <Icon name="arrow-right" size={20} />
          </UiLink>
          {messengerUrl !== null && (
            <UiLink to={messengerUrl} className={aBtnGhostClasses}>
              <Icon name="message-circle" size={20} />
              {COPY.messenger}
            </UiLink>
          )}
        </div>
      </div>
    </section>
  );
}
