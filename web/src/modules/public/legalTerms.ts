// SPEC-GAP: the Terms of Use draft (UI-SPEC L4; LEGAL-03, D-08, D-09, D-10). Plain English, drafted for the owner's review.
// It gives no payment share, turnaround time, refund rule or warranty: the owner has not given one, so open business terms say
// "we will confirm this with you in your quote". The version, date and approval flag come from legalPages.ts.
import type { LegalText } from './legalContent';
import { LEGAL_PAGES } from './legalPages';

export const TERMS_TEXT: LegalText = {
  meta: LEGAL_PAGES.terms,
  sections: [
    {
      id: 'about-these-terms',
      heading: 'About these terms',
      blocks: [
        {
          kind: 'p',
          parts: [
            'These terms explain how you can use this website and how a quote request works. By using the website, you agree to them.',
          ],
        },
        { kind: 'p', parts: ['If you do not agree, please do not use the website.'] },
      ],
    },
    {
      id: 'using-this-website',
      heading: 'Using this website',
      blocks: [
        { kind: 'p', parts: ['You can read this website and send us a quote request for free. Please:'] },
        {
          kind: 'ul',
          items: [
            ['Give us true and correct details when you contact us.'],
            ['Send only files and messages that are safe and that you are allowed to send.'],
            ['Do not try to break the website, overload it or get into the parts that are not for visitors.'],
          ],
        },
      ],
    },
    {
      id: 'prices-and-quotes',
      heading: 'Prices and quotes',
      blocks: [
        {
          kind: 'p',
          parts: ['The prices on this website are a guide. Your final price depends on what you ask us to make.'],
        },
        {
          kind: 'p',
          parts: [
            'A quote request is not an order. For the price, the quantity, how payment works and the timing, we will confirm this with you in your quote.',
          ],
        },
      ],
    },
  ],
};
