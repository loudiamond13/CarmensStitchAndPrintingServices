import { describe, expect, it } from 'vitest';
import { isQuoteStatus, QUOTE_STATUS_TONE, quoteStatusLabel } from './quoteStatus';

// The quote request statuses (UI-SPEC Color "Status tones"): each has its tone and its word.

describe('QUOTE_STATUS_TONE', () => {
  it('gives each status its existing tone', () => {
    expect(QUOTE_STATUS_TONE).toEqual({
      new: 'accent',
      contacted: 'info',
      quoted: 'mockup',
      converted: 'success',
      closed: 'neutral',
      spam: 'danger',
    });
  });
});

describe('quoteStatusLabel', () => {
  it.each([
    ['new', 'New'],
    ['contacted', 'Contacted'],
    ['quoted', 'Quoted'],
    ['converted', 'Converted'],
    ['closed', 'Closed'],
    ['spam', 'Spam'],
  ])('names %s "%s"', (key, label) => {
    expect(quoteStatusLabel(key)).toBe(label);
  });

  it('shows a key it does not know as sent', () => {
    expect(quoteStatusLabel('archived')).toBe('archived');
  });
});

describe('isQuoteStatus', () => {
  it('knows the six keys and nothing else', () => {
    expect(isQuoteStatus('quoted')).toBe(true);
    expect(isQuoteStatus('open')).toBe(false);
    expect(isQuoteStatus('New')).toBe(false);
  });
});
