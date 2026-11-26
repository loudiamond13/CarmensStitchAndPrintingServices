// The quote form's place on the Contact page. The form is its own piece, so a failed load (a weak connection, or a deploy that
// replaced the piece) must not take the page down: a small message with Try Again takes the form's place and the rest of the page
// stays. Try Again makes a new lazy component, because React keeps the first failure of one.
import { Component, lazy, Suspense, useState, type ReactNode } from 'react';
import { ErrorState } from '@/components/states/ErrorState';
import { PUBLIC_COPY } from '../copy';
import { loadQuoteForm, type QuoteFormLoader } from './lazyQuoteForm';
import { quoteFormPlaceholderClasses } from './quoteForm.recipe';
import { SkeletonLines } from './SkeletonLines';

const COPY = PUBLIC_COPY.contact.formLoadFailed;

interface LoadBoundaryProps {
  children: ReactNode;
  onRetry: () => void;
}

/** Shows the failed-load message in place of its children once one of them throws. A new key (Try Again) starts it fresh. */
class LoadBoundary extends Component<LoadBoundaryProps, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override render(): ReactNode {
    if (this.state.failed) {
      return <ErrorState align="start" title={COPY.title} message={COPY.body} onRetry={this.props.onRetry} />;
    }
    return this.props.children;
  }
}

export interface QuoteFormSlotProps {
  /** Loads the form's piece; tests pass their own. */
  load?: QuoteFormLoader;
}

export function QuoteFormSlot({ load = loadQuoteForm }: QuoteFormSlotProps) {
  const [attempt, setAttempt] = useState(() => ({ id: 0, Form: lazy(load) }));
  const { Form } = attempt;
  const retry = (): void => {
    setAttempt((previous) => ({ id: previous.id + 1, Form: lazy(load) }));
  };
  return (
    <LoadBoundary key={attempt.id} onRetry={retry}>
      <Suspense
        fallback={
          <div className={quoteFormPlaceholderClasses} aria-hidden="true">
            <SkeletonLines lines={3} />
          </div>
        }
      >
        <Form />
      </Suspense>
    </LoadBoundary>
  );
}
