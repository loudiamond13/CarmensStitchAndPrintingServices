// MSW answers for the quote form tests (INQ-01, INQ-03): the ticket read and the create, each recording what the form sent.
import { http, HttpResponse } from 'msw';
import type { CreateQuoteBody } from '@/modules/public/services/quoteService';
import { server } from './msw';

export const QUOTE_ID = '7b1d6c58-3c7e-4a0e-9f0b-2f3c5a1b9d10';

export interface QuoteProbe {
  /** The tickets handed out, newest last. */
  tickets: string[];
  /** Every create the form sent: the body and its Idempotency-Key. */
  creates: { body: CreateQuoteBody; key: string | null }[];
}

export interface QuoteAnswers {
  /** The status of the next creates, in order; the last one repeats. 200 saves. Default: 200. */
  createStatuses?: readonly number[];
  /** The replacement ticket an expired-ticket 400 carries. */
  replacementTicket?: string;
  /** Makes a 400 create answer the expired-ticket code with no replacement ticket (a proxy or a server change dropped it). */
  expiredWithoutReplacement?: boolean;
  /** Fails the ticket read with this status. */
  ticketStatus?: number;
  /** The minimum seconds the ticket answer and the expired-ticket 400 carry (D-41). Default: 0, so tests never wait. */
  minimumSeconds?: number;
}

/** The default answer of every test: the form ticket read (the Contact page reads it). A test that checks the ticket or the create calls answerQuote. */
export function quoteTicketHandler() {
  return http.get('*/api/v1/public/quote-requests/ticket', () =>
    HttpResponse.json({
      ticket: 'ticket-default',
      photoRules: { maxPhotos: 5, maxBytes: 10_485_760, maxPixels: 25_000_000 },
      minimumSeconds: 0,
    }),
  );
}

/** Answers the ticket and the create; returns what the form sent. Numbered tickets: `ticket-1`, `ticket-2`, ... */
export function answerQuote(answers: QuoteAnswers = {}): QuoteProbe {
  const probe: QuoteProbe = { tickets: [], creates: [] };
  const statuses = answers.createStatuses ?? [200];
  server.use(
    http.get('*/api/v1/public/quote-requests/ticket', () => {
      if (answers.ticketStatus !== undefined) {
        return HttpResponse.json({ title: 'Failed', status: answers.ticketStatus }, { status: answers.ticketStatus });
      }
      const ticket = `ticket-${String(probe.tickets.length + 1)}`;
      probe.tickets.push(ticket);
      return HttpResponse.json({
        ticket,
        photoRules: { maxPhotos: 5, maxBytes: 10_485_760, maxPixels: 25_000_000 },
        minimumSeconds: answers.minimumSeconds ?? 0,
      });
    }),
    http.post('*/api/v1/public/quote-requests', async ({ request }) => {
      const status = statuses[Math.min(probe.creates.length, statuses.length - 1)] ?? 200;
      const body = (await request.json()) as CreateQuoteBody;
      probe.creates.push({ body, key: request.headers.get('Idempotency-Key') });
      if (status === 200) {
        // One place per declared file name, in the order sent (INQ-02).
        return HttpResponse.json({
          id: QUOTE_ID,
          photoSlots: (body.photos ?? []).map((fileName, slot) => ({ slot, fileName })),
        });
      }
      if (status === 400 && answers.expiredWithoutReplacement === true) {
        return HttpResponse.json(
          {
            title: 'The form timed out. Please send it again.',
            status: 400,
            code: 'quote-requests.ticket-expired',
            errors: { ticket: ['The form timed out. Please send it again.'] },
          },
          { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
        );
      }
      if (status === 400 && answers.replacementTicket !== undefined) {
        return HttpResponse.json(
          {
            title: 'The form timed out. Please send it again.',
            status: 400,
            code: 'quote-requests.ticket-expired',
            errors: { ticket: ['The form timed out. Please send it again.'] },
            replacementTicket: answers.replacementTicket,
            minimumSeconds: answers.minimumSeconds ?? 0,
          },
          { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
        );
      }
      return HttpResponse.json(
        { title: 'Something went wrong.', status },
        { status, headers: { 'Content-Type': 'application/problem+json' } },
      );
    }),
  );
  return probe;
}
