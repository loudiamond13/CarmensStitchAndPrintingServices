// The quote form when its server-answer piece cannot load (D-43): the visitor is offline, so the send-failed words show and every
// value stays. The next send asks for the piece again.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback/ToastProvider';
import { answerQuote } from '@/test/quoteFixtures';
import { loadQuoteSendAnswers } from './lazyQuoteSendAnswers';
import { QuoteForm } from './QuoteForm';

vi.mock('./lazyQuoteSendAnswers', () => ({
  loadQuoteSendAnswers: vi.fn(() => Promise.reject(new Error('Failed to fetch dynamically imported module'))),
}));

function renderForm() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter>
      <ToastProvider>{children}</ToastProvider>
    </MemoryRouter>
  );
  return render(<QuoteForm />, { wrapper });
}

describe('QuoteForm without its server-answer piece', () => {
  it('shows the send-failed words, keeps the values, and asks for the piece again on the next send', async () => {
    answerQuote({ createStatuses: [500] });
    renderForm();
    await userEvent.type(screen.getByRole('textbox', { name: /Your name/ }), 'Juan Dela Cruz');
    await userEvent.type(screen.getByRole('textbox', { name: /Contact number/ }), '0917 123 4567');

    await userEvent.click(screen.getByRole('button', { name: 'Send Inquiry' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't send your inquiry. Check your internet connection and try again. What you typed is still here.",
    );
    expect(screen.getByRole('textbox', { name: /Your name/ })).toHaveValue('Juan Dela Cruz');

    await userEvent.click(screen.getByRole('button', { name: 'Send Inquiry' }));

    expect(loadQuoteSendAnswers).toHaveBeenCalledTimes(2);
  });
});
