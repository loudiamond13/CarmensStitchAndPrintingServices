// The form ticket the Get a Quote form holds (INQ-03, Pitfall 4, D-38, D-40): read when the form opens and again on Send Another.
// It is kept in plain state, not in a query cache, so the public side never loads TanStack Query (PERF-02) and no ticket is
// shared between two visits of the form. A ticket stays good for its whole lifetime on the server, so the form uses it for
// every send until it is told it expired and given a replacement.
import { useEffect, useState } from 'react';
import { quoteService, type QuoteFormTicket, type QuoteService } from '../services/quoteService';

/** A ticket and when this browser got it, so the form can wait out the server's minimum time. */
export interface HeldTicket {
  readonly ticket: string;
  /** The browser clock (ms) when the ticket arrived; 0 for a replacement, which the server counts as old enough. */
  readonly issuedAt: number;
}

export interface QuoteTicketHolder {
  /** Settles with the ticket now held once its read ends; null when the read failed (the server then answers with a replacement). */
  ready(): Promise<HeldTicket | null>;
  /** Reads a new ticket now. */
  refresh(): void;
  /** Keeps the replacement ticket of an expired answer. */
  adopt(ticket: string): void;
  /** Cancels a read that is still running. */
  stop(): void;
}

export interface QuoteTicketClock {
  readonly now: () => number;
}

/** The ticket holder, apart from React so its rules can be tested alone. */
export function createQuoteTicketHolder(
  read: QuoteService['getTicket'],
  clock: QuoteTicketClock = { now: () => Date.now() },
): QuoteTicketHolder {
  let current: Promise<HeldTicket | null> = Promise.resolve(null);
  let running: AbortController | undefined;

  const stop = (): void => {
    running?.abort();
    running = undefined;
  };

  return {
    ready: () => current,
    refresh: () => {
      stop();
      const controller = new AbortController();
      running = controller;
      current = read(controller.signal).then(
        (answer: QuoteFormTicket) => ({ ticket: answer.ticket, issuedAt: clock.now() }),
        () => null,
      );
    },
    adopt: (ticket) => {
      stop();
      current = Promise.resolve({ ticket, issuedAt: 0 });
    },
    stop,
  };
}

/** Holds the form's ticket: read once the form shows, cancelled when it goes away. */
export function useQuoteTicket(): QuoteTicketHolder {
  const [holder] = useState(() => createQuoteTicketHolder((signal) => quoteService.getTicket(signal)));
  useEffect(() => {
    holder.refresh();
    return () => {
      holder.stop();
    };
  }, [holder]);
  return holder;
}
