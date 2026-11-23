// The form ticket holder (INQ-03, D-38, D-41): it keeps the ticket with when it arrived and how long the server says to wait.
import { describe, expect, it } from 'vitest';
import type { QuoteFormTicket } from '../services/quoteService';
import { createQuoteTicketHolder } from './useQuoteTicket';

const RULES = { maxPhotos: 5, maxBytes: 10_485_760, maxPixels: 25_000_000 };

function answer(minimumSeconds: number | string): QuoteFormTicket {
  return { ticket: 'ticket-1', photoRules: RULES, minimumSeconds };
}

describe('createQuoteTicketHolder', () => {
  it('holds the ticket, the time it arrived and the minimum seconds of the answer', async () => {
    const holder = createQuoteTicketHolder(() => Promise.resolve(answer(7)), { now: () => 1000 });

    holder.refresh();

    await expect(holder.ready()).resolves.toEqual({
      ticket: 'ticket-1',
      issuedAt: 1000,
      minimumSeconds: 7,
      photoRules: RULES,
    });
  });

  it('reads the photo rules as numbers even when the answer sends them as text', async () => {
    const holder = createQuoteTicketHolder(
      () =>
        Promise.resolve({
          ticket: 'ticket-1',
          photoRules: { maxPhotos: '4', maxBytes: '5242880', maxPixels: '12000000' },
          minimumSeconds: 0,
        }),
      { now: () => 0 },
    );

    holder.refresh();

    await expect(holder.ready()).resolves.toMatchObject({
      photoRules: { maxPhotos: 4, maxBytes: 5_242_880, maxPixels: 12_000_000 },
    });
  });

  it('keeps the photo rules of the ticket read when it adopts a replacement', async () => {
    const holder = createQuoteTicketHolder(() => Promise.resolve(answer(7)), { now: () => 5000 });
    holder.refresh();
    await holder.ready();

    holder.adopt('ticket-replacement', 9);

    await expect(holder.ready()).resolves.toMatchObject({ ticket: 'ticket-replacement', photoRules: RULES });
  });

  it('reads the minimum seconds when the answer sends them as text', async () => {
    const holder = createQuoteTicketHolder(() => Promise.resolve(answer('12')), { now: () => 0 });

    holder.refresh();

    await expect(holder.ready()).resolves.toMatchObject({ minimumSeconds: 12 });
  });

  it('holds nothing when the read fails', async () => {
    const holder = createQuoteTicketHolder(() => Promise.reject(new Error('offline')), { now: () => 0 });

    holder.refresh();

    await expect(holder.ready()).resolves.toBeNull();
  });

  it('keeps a replacement as already old enough, with the minimum seconds its 400 carried', async () => {
    const holder = createQuoteTicketHolder(() => Promise.resolve(answer(7)), { now: () => 5000 });

    holder.adopt('ticket-replacement', 9);

    await expect(holder.ready()).resolves.toEqual({ ticket: 'ticket-replacement', issuedAt: 0, minimumSeconds: 9 });
  });
});
