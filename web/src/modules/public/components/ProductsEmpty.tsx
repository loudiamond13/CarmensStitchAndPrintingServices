// ProductsEmpty (UI-SPEC P1 States, Empty): with no shown line, "Our product list is being updated" and one button, Message Us
// to the Messenger link, or Get a Quote to /contact without one. It loads as its own chunk (lazyProducts.ts), so the empty
// state's parts stay out of the Products route's first download (PERF-01).
import { buttonClasses } from '@/components/actions/button.recipe';
import { UiLink } from '@/components/actions/UiLink';
import { EmptyState } from '@/components/feedback/EmptyState';
import { PUBLIC_COPY } from '../copy';
import { stateWrapClasses } from './products.recipe';

const { empty: EMPTY } = PUBLIC_COPY.products;

// The ButtonLink look without importing ButtonLink: a second reader of it split it into a chunk of its own (PERF-01).
const primaryButton = buttonClasses({ variant: 'primary', size: 'md' });

export interface ProductsEmptyProps {
  /** The Messenger link, or null when none is set. */
  messengerUrl: string | null;
}

export function ProductsEmpty({ messengerUrl }: ProductsEmptyProps) {
  return (
    <div className={stateWrapClasses}>
      <EmptyState
        icon="shirt"
        title={EMPTY.title}
        message={EMPTY.message}
        action={
          messengerUrl === null ? (
            <UiLink to="/contact" className={primaryButton}>
              {PUBLIC_COPY.actions.getQuote}
            </UiLink>
          ) : (
            <UiLink to={messengerUrl} className={primaryButton}>
              {PUBLIC_COPY.actions.messageUs}
            </UiLink>
          )
        }
      />
    </div>
  );
}

export default ProductsEmpty;
