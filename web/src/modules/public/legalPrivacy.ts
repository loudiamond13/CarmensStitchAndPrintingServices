// SPEC-GAP: the Privacy Policy draft (UI-SPEC L2; LEGAL-01, D-01 to D-06, D-08, D-10, D-11, D-12, D-15, D-36). Plain English, drafted
// for the owner's review (D-09). The business and the contact lines come from the site settings at run time (D-11); the retention
// lines are the owner's rulings, word for word. The version, date and approval flag come from legalPages.ts.
import type { LegalText } from './legalContent';
import { LEGAL_PAGES } from './legalPages';

export const PRIVACY_TEXT: LegalText = {
  meta: LEGAL_PAGES.privacy,
  sections: [
    {
      id: 'who-we-are',
      heading: 'Who we are',
      blocks: [
        { kind: 'p', parts: ['This website is run by:'] },
        { kind: 'facts', show: ['business', 'dpo'] },
        {
          kind: 'p',
          parts: [
            'We decide what personal information we collect and how we use it. This policy follows the Data Privacy Act of 2012 (Republic Act No. 10173) of the Philippines.',
          ],
        },
      ],
    },
    {
      id: 'how-long-we-keep-it',
      heading: 'How long we keep it',
      blocks: [
        {
          kind: 'dl',
          items: [
            {
              term: 'Orders, payments, discounts and expenses',
              parts: ['Kept for good. They are our bookkeeping and tax records.'],
            },
            {
              term: "Quote requests that didn't become an order, and their files",
              parts: ['Deleted 6 months after we receive them.'],
            },
            {
              term: 'Visitor stats (visits, pages and page speed)',
              parts: [
                'Kept for about 13 months; removed at the next monthly cleanup. After that we keep only daily totals, which have no visitor id.',
              ],
            },
            {
              term: 'Daily visitor totals',
              parts: ['Deleted after 3 years. They have no visitor id.'],
            },
            {
              term: 'Your cookie choice',
              parts: [
                'Kept for about 13 months; removed at the next monthly cleanup. A choice lasts 12 months, plus 1 month.',
              ],
            },
            {
              term: 'Staff account activity log',
              parts: ['Kept for 8 months.'],
            },
          ],
        },
      ],
    },
  ],
};
