// ProductsHelp (UI-SPEC P1 item 4, App. E.2): "Not sure what to pick?" with Get a Quote to /contact and Message us to the
// Messenger link, or to /contact when no Messenger link is set (D-19). It stays on the page in every state. It loads as its
// own chunk (lazyProducts.ts), and the Messenger link comes from the layout (PublicOutletContext), which already reads the
// shop facts for the footer; a second reader of the facts hook would split it into its own chunk (PERF-01).
import { useOutletContext } from 'react-router';
import { UiLink } from '@/components/actions/UiLink';
import { Icon } from '@/components/brand/Icon';
import { PUBLIC_COPY } from '../copy';
import type { PublicOutletContext } from '../outletContext';
import {
  articleButtonsClasses,
  helpCardClasses,
  helpSectionClasses,
  helpTextClasses,
  helpTitleClasses,
  prodWrapClasses,
} from './products.recipe';
import { aBtnPrimaryClasses, aBtnSecondaryClasses, eyebrowClasses } from './public.recipe';

const { help: HELP } = PUBLIC_COPY.products;

export function ProductsHelp() {
  // Outside the public layout (a part shown on its own) there is no context, so the link goes to Contact.
  const context = useOutletContext<PublicOutletContext | undefined>();
  const messengerUrl = context?.messengerUrl ?? null;
  return (
    <section className={helpSectionClasses}>
      <div className={prodWrapClasses}>
        <div className={helpCardClasses}>
          <div className={helpTextClasses}>
            <span className={eyebrowClasses}>{HELP.eyebrow}</span>
            <h2 className={helpTitleClasses}>{HELP.headline}</h2>
          </div>
          <div className={articleButtonsClasses}>
            <UiLink to="/contact" className={aBtnPrimaryClasses}>
              {PUBLIC_COPY.actions.getQuote}
            </UiLink>
            <UiLink to={messengerUrl ?? '/contact'} className={aBtnSecondaryClasses}>
              <Icon name="message-circle" size={20} />
              {HELP.messageUs}
            </UiLink>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ProductsHelp;
