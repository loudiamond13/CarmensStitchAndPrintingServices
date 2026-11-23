// The Get a Quote result (UI-SPEC Q3, D-03): success, and success with photos that did not upload, named with where to send them.
// QuoteMissingPhotos loads with the photo piece; QuoteSentResult is in the form's own piece.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { QuoteSentResult } from './QuoteFormResult';
import { QuoteMissingPhotos, type QuoteMissingPhotosProps } from './QuoteMissingPhotos';

const MESSENGER = 'https://m.me/cspsdemo';

/** The result as the form shows it: the missing photos note only when a photo did not upload. */
function renderSent(props: Partial<QuoteMissingPhotosProps> = {}) {
  const onSendAnother = vi.fn();
  const { missing = [], total = 0, messengerUrl = MESSENGER } = props;
  const view = render(
    <MemoryRouter>
      <QuoteSentResult
        onSendAnother={onSendAnother}
        photosNote={
          missing.length > 0 && <QuoteMissingPhotos missing={missing} total={total} messengerUrl={messengerUrl} />
        }
      />
    </MemoryRouter>,
  );
  return { ...view, onSendAnother };
}

describe('QuoteSentResult: everything arrived', () => {
  it('shows Inquiry sent, the message and Send Another, with no photo note and no Messenger button', async () => {
    const { onSendAnother } = renderSent({ total: 2 });

    expect(screen.getByRole('heading', { level: 2, name: 'Inquiry sent' })).toBeInTheDocument();
    expect(
      screen.getByText("Thanks! We'll message you with a mockup and quote, usually the same day."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/didn't upload/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Message Us on Messenger' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Send Another' }));
    expect(onSendAnother).toHaveBeenCalledOnce();
  });
});

describe('QuoteSentResult: some photos did not upload (D-03)', () => {
  it('names the missing photos, joined by commas, with the count', () => {
    renderSent({ missing: ['logo.png', 'sketch.heic'], total: 3 });

    expect(
      screen.getByText(
        "We got your request, but 2 of your photos didn't upload: logo.png, sketch.heic. Please send them to us on Messenger.",
      ),
    ).toBeInTheDocument();
  });

  it('says it in the singular for one photo', () => {
    renderSent({ missing: ['sketch.heic'], total: 2 });

    expect(
      screen.getByText(
        "We got your request, but 1 of your photos didn't upload: sketch.heic. Please send it to us on Messenger.",
      ),
    ).toBeInTheDocument();
  });

  it('uses the all-failed sentence when no photo arrived', () => {
    renderSent({ missing: ['logo.png', 'sketch.heic'], total: 2 });

    expect(
      screen.getByText("We got your request, but your photos didn't upload. Please send them to us on Messenger."),
    ).toBeInTheDocument();
  });

  it('offers Message Us on Messenger, same tab, before Send Another', () => {
    renderSent({ missing: ['logo.png'], total: 2 });

    const link = screen.getByRole('link', { name: 'Message Us on Messenger' });
    expect(link).toHaveAttribute('href', MESSENGER);
    expect(link).not.toHaveAttribute('target');
    const another = screen.getByRole('button', { name: 'Send Another' });
    expect(link.compareDocumentPosition(another) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('leaves the Messenger button out when no link is set or the shop facts failed to load', () => {
    renderSent({ missing: ['logo.png'], total: 2, messengerUrl: null });

    expect(screen.getByText(/1 of your photos didn't upload/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Message Us on Messenger' })).not.toBeInTheDocument();
  });

  it('has no axe violations with some photos missing', async () => {
    const { container } = renderSent({ missing: ['logo.png'], total: 2 });

    await expectNoAxeViolations(container);
  });

  it('has no axe violations with every photo missing and no Messenger link', async () => {
    const { container } = renderSent({ missing: ['logo.png', 'sketch.heic'], total: 2, messengerUrl: null });

    await expectNoAxeViolations(container);
  });
});
