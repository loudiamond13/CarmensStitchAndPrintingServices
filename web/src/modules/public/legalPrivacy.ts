// SPEC-GAP: the Privacy Policy draft (UI-SPEC L2; LEGAL-01, D-01 to D-06, D-08, D-10 to D-13, D-15, D-36, D-40). Plain English,
// drafted for the owner's review (D-09). It claims no lawyer review and promises nothing the owner has not ruled. The business and the
// contact lines come from the site settings at run time (D-11); the retention lines are the owner's rulings, word for word; the
// handlers are the owner's list (D-40). The version, date and approval flag come from legalPages.ts.
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
      id: 'what-we-collect',
      heading: 'What we collect',
      blocks: [
        { kind: 'p', parts: ['What we collect depends on how you use this website.'] },
        {
          kind: 'ul',
          items: [
            ['When you send a quote request: the details you type into the form, and any files you attach.'],
            [
              'When you place an order with us: the details our staff enter about it, such as who it is for, what is ordered, the price and the payments.',
            ],
            ['Photos of your order that our staff add to it.'],
            [
              'Visitor stats, only if you allow them: the pages you open, where you came from, the kind of device and browser you use, how fast our pages load, and a random visitor id in a cookie. If you say no, we only count the page and the day, with no visitor id. We also keep a record of your cookie choice.',
            ],
            [
              "For our staff accounts: each staff member's name, email and sign-in details, and a log of what they do in the admin area.",
            ],
          ],
        },
      ],
    },
    {
      id: 'why-we-use-it',
      heading: 'Why we use it',
      blocks: [
        {
          kind: 'dl',
          items: [
            {
              term: 'Orders and payments',
              parts: [
                'To make your order, keep track of payments and tell you about it. Our basis is the contract with you. We also keep our bookkeeping and tax records because the law says we must.',
              ],
            },
            {
              term: 'Quote requests',
              parts: [
                'To read your request and send you a quote. Our basis is that you asked us to, as a step before a contract.',
              ],
            },
            {
              term: 'Visitor stats and the map',
              parts: [
                'To learn which pages people use and how fast they load, and to show the Google map on the Contact page. Our basis is your consent. We use them only if you allow them, and you can change your choice at any time in Cookie Settings. The ',
                { text: 'Cookie Policy', href: '/cookies' },
                ' says more.',
              ],
            },
            {
              term: 'Staff accounts',
              parts: [
                'To keep staff sign-ins safe and to record who did what in the admin area. Our basis is our legitimate interest in keeping the business and your information secure.',
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'photos-of-your-order',
      heading: 'Photos of your order',
      blocks: [
        {
          kind: 'p',
          parts: [
            'A photo of an order is shown on our public website only when the customer said it is OK to show. We show it with no name, price or other detail.',
          ],
        },
      ],
    },
    {
      id: 'who-else-handles-it',
      heading: 'Who else handles it',
      blocks: [
        { kind: 'p', parts: ['These services handle some of your information for us:'] },
        {
          kind: 'ul',
          items: [
            ['The web host that runs this website.'],
            ['Cloudinary, which stores and shows our photos.'],
            ['The email sender, which delivers the emails we send.'],
            ['Google, for the map on the Contact page. This happens only if you allow it.'],
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
              parts: ['Kept for about 6 months after we receive them; removed at the next monthly cleanup.'],
            },
            {
              term: 'Visitor stats (visits, pages and page speed)',
              parts: [
                'Kept for about 13 months; removed at the next monthly cleanup. After that we keep only daily totals, which have no visitor id.',
              ],
            },
            {
              term: 'Daily visitor totals',
              parts: ['Kept for about 3 years; removed at the next monthly cleanup. They have no visitor id.'],
            },
            {
              term: 'Your cookie choice',
              parts: [
                'Kept for about 13 months; removed at the next monthly cleanup. A choice lasts 12 months, plus 1 month.',
              ],
            },
            {
              term: 'Staff account activity log',
              parts: ['Kept for about 8 months; removed at the next monthly cleanup.'],
            },
          ],
        },
      ],
    },
    {
      id: 'your-rights',
      heading: 'Your rights',
      blocks: [
        { kind: 'p', parts: ['The Data Privacy Act of 2012 gives you these rights:'] },
        {
          kind: 'dl',
          items: [
            {
              term: 'To be informed',
              parts: ['You can know what we collect, why, and who else handles it. This policy tells you.'],
            },
            { term: 'To access', parts: ['You can ask for a copy of the personal information we hold about you.'] },
            {
              term: 'To object',
              parts: ['You can say no to some uses of your information, such as visitor stats.'],
            },
            {
              term: 'To erasure or blocking',
              parts: ['You can ask us to remove your information or stop using it, when the law allows.'],
            },
            {
              term: 'To correct (rectification)',
              parts: ['You can ask us to fix information that is wrong or out of date.'],
            },
            {
              term: 'To data portability',
              parts: ['You can ask for your information in a form you can reuse, where this applies.'],
            },
            {
              term: 'To damages',
              parts: ['You can claim payment for harm if your information is misused, as the law provides.'],
            },
            {
              term: 'To complain to the National Privacy Commission',
              parts: ['You can complain if you think we handled your information wrongly.'],
            },
          ],
        },
        {
          kind: 'p',
          parts: ['Some rights have limits. For example, we must keep our tax and bookkeeping records.'],
        },
      ],
    },
    {
      id: 'how-to-ask-about-your-data',
      heading: 'How to ask about your data',
      blocks: [
        { kind: 'p', parts: ['To use any of these rights, or to ask about your information, contact us:'] },
        { kind: 'facts', show: ['contact'] },
        { kind: 'p', parts: ['The owner, as our Data Protection Officer, answers these requests.'] },
        { kind: 'p', parts: ['Please tell us what you would like, and how we can reach you.'] },
      ],
    },
    {
      id: 'complaints-to-the-national-privacy-commission',
      heading: 'Complaints to the National Privacy Commission',
      blocks: [
        {
          kind: 'p',
          parts: [
            'You can complain to the National Privacy Commission at ',
            { text: 'privacy.gov.ph', href: 'https://www.privacy.gov.ph', external: true },
            '. We ask that you contact us first so we can fix it.',
          ],
        },
      ],
    },
    {
      id: 'changes-to-this-policy',
      heading: 'Changes to this policy',
      blocks: [
        {
          kind: 'p',
          parts: [
            'If we change this policy, we publish the new version on this page. The version and the date of the last update are shown at the top.',
          ],
        },
      ],
    },
  ],
};
