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
    {
      id: 'your-designs-logos-and-names',
      heading: 'Your designs, logos and names',
      blocks: [
        {
          kind: 'p',
          parts: [
            'When you send us designs, logos and names for your order, you confirm that you are allowed to use the designs, logos and names you send us. For example, they are yours, or their owner has said you may use them.',
          ],
        },
        { kind: 'p', parts: ['We use what you send only to make your order.'] },
      ],
    },
    {
      id: 'photos-of-our-work',
      heading: 'Photos of our work',
      blocks: [
        {
          kind: 'p',
          parts: [
            'We may show photos of finished work in the gallery. We show the photos of an order only when the customer has said it is OK.',
          ],
        },
      ],
    },
    {
      id: 'links-to-other-sites',
      heading: 'Links to other sites',
      blocks: [
        {
          kind: 'p',
          parts: [
            'This website may link to other sites, such as Messenger and Google Maps. We do not run those sites and we are not responsible for what is on them. They have their own terms and privacy rules.',
          ],
        },
      ],
    },
    {
      id: 'our-responsibility',
      heading: 'Our responsibility',
      blocks: [
        {
          kind: 'p',
          parts: [
            'We try to keep the information on this website correct and up to date, but we cannot promise that it is always complete. The website is offered as it is.',
          ],
        },
        {
          kind: 'p',
          parts: [
            'This does not take away any right you have under Philippine consumer law. Nothing here limits those rights.',
          ],
        },
      ],
    },
    {
      id: 'philippine-law',
      heading: 'Philippine law',
      blocks: [
        {
          kind: 'p',
          parts: [
            'These terms follow Philippine law, including the Consumer Act of the Philippines (RA 7394) and the Internet Transactions Act of 2023 (RA 11967).',
          ],
        },
        { kind: 'p', parts: ['Nothing in these terms takes away your rights under those laws.'] },
        {
          kind: 'p',
          parts: [
            'Our ',
            { text: 'Privacy Policy', href: '/privacy' },
            ' explains how we handle your personal information.',
          ],
        },
      ],
    },
    {
      id: 'changes-to-these-terms',
      heading: 'Changes to these terms',
      blocks: [
        {
          kind: 'p',
          parts: ['We may change these terms. When we do, we change the version and the date at the top of this page.'],
        },
      ],
    },
    {
      id: 'contact-us',
      heading: 'Contact us',
      blocks: [
        { kind: 'p', parts: ['If you have a question about these terms, please contact us.'] },
        { kind: 'facts', show: ['business', 'contact'] },
      ],
    },
  ],
};
