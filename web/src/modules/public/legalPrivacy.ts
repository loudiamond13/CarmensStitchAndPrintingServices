// SPEC-GAP: the Privacy Policy draft (UI-SPEC L2; LEGAL-01, D-01 to D-06, D-08, D-10 to D-13, D-15, D-36, D-40). Plain English,
// drafted for the owner's review (D-09). It claims no lawyer review and promises nothing the owner has not ruled. The business and the
// contact lines come from the site settings at run time (D-11); the retention lines are the owner's rulings, word for word; the
// handlers are the owner's list (D-40). The version, date and approval flag come from legalPages.ts.
// It covers the daily page count, the few necessary cookies and the one saved map setting (D-46, D-65, D-72, D-134). The owner approved
// the wording at version 1.0 (D-73, D-135). Quote requests are covered; draft 1.1, wording for the owner to approve (D-28).
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
            [
              'When you place an order with us: the details our staff enter about it, such as who it is for, what is ordered, the price and the payments.',
            ],
            ['Photos of your order that our staff add to it.'],
            [
              'When you send a quote request: the details you type into the form (name, team, mobile number, email, product, quantity and message) and any photos you attach.',
            ],
            [
              'A daily page count: each time a page is opened, we add one to the count for that page and that day. We keep only the page and the day, and nothing about who opened it.',
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
                'Only to reply to your request and prepare your quote. Our basis is that you asked us to, as a step before a contract.',
              ],
            },
            {
              term: 'Page counts',
              parts: [
                'To learn which pages people open. A count is only a number for a page and a day. It holds no personal information.',
              ],
            },
            {
              term: 'The map',
              parts: [
                'To show the Google map on the Contact page. The map loads from Google when you tap Show Map. After your first tap, this browser loads the map by itself until you clear the saved setting. Our basis is your consent: that tap is your choice.',
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
            ['Cloudinary, which stores and shows our photos, including the photos you attach to a quote request.'],
            [
              'The email sender, which delivers the emails we send, including the alert our staff get about a quote request.',
            ],
            [
              'Google, for the map on the Contact page. This happens when you tap Show Map. After your first tap, this browser loads the map by itself until you clear the saved setting.',
            ],
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
              term: "Quote requests that didn't become an order, and their photos",
              parts: ['Deleted 6 months after we receive them.'],
            },
            {
              term: 'Quote requests that became an order, and their photos',
              parts: ['Kept as long as the order.'],
            },
            {
              term: 'Photos sent with a request we mark as spam',
              parts: ['Deleted within a day.'],
            },
            {
              term: 'Daily page counts',
              parts: ['Deleted about 3 years after the day they count.'],
            },
            {
              term: 'Staff account activity log',
              parts: ['Deleted about 8 months after it is recorded.'],
            },
          ],
        },
        {
          kind: 'p',
          parts: [
            'Rarely, a photo that finishes uploading at the moment its request is marked as spam or deleted, or its order is deleted, can stay in storage for up to 3 days before it is removed.',
          ],
        },
      ],
    },
    {
      id: 'cookies-and-saved-settings',
      heading: 'Cookies and saved settings',
      blocks: [
        {
          kind: 'p',
          parts: [
            'This website sets no optional cookies, so it shows no cookie banner. Nothing optional is saved in your browser unless you choose it.',
          ],
        },
        { kind: 'h3', text: 'Necessary cookies' },
        {
          kind: 'p',
          parts: [
            'Only our staff get these cookies, to sign in to the admin area. A visitor who is not staff does not get them.',
          ],
        },
        {
          kind: 'dl',
          items: [
            {
              term: '__Secure-csps_rt',
              parts: ['What it does: Staff sign-in only. Keeps a staff member signed in to the admin area.'],
              more: [
                [
                  'How long it lasts: Until the browser closes, or 90 days if the staff member chose "Keep me signed in". A sign-in that is not kept also ends after 12 hours.',
                ],
              ],
            },
            {
              term: '__Secure-csps_2fa',
              parts: ['What it does: Staff sign-in only. Holds a sign-in that is waiting for its sign-in code.'],
              more: [['How long it lasts: 30 minutes.']],
            },
            {
              term: '__Secure-csps_staff',
              parts: [
                'What it does: Staff sign-in only. Tells the site that this browser belongs to signed-in staff, so staff visits are left out of the page counts.',
              ],
              more: [
                [
                  'How long it lasts: The same as the staff sign-in: until the browser closes, or 90 days if the staff member chose "Keep me signed in".',
                ],
              ],
            },
          ],
        },
        { kind: 'h3', text: 'Settings saved in this browser' },
        {
          kind: 'p',
          parts: ['These settings are not cookies. They stay in your browser and are never sent to us.'],
        },
        {
          kind: 'dl',
          items: [
            {
              term: 'Admin settings in this browser',
              parts: [
                'What it does: Staff only. Saves the admin theme and the orders view that a staff member picked, in this browser only. It is not a cookie.',
              ],
              more: [['How long it lasts: Until it is changed or cleared. Clearing your cookies and data removes it.']],
            },
            {
              term: 'Saved map setting',
              parts: [
                'What it does: Saved after you tap Show Map, so the map loads by itself the next time you visit from this browser. One setting covers every Google map on this site.',
              ],
              more: [
                [
                  "How long it lasts: It has no expiry. It stays until you clear this website's data in your browser's settings.",
                ],
                [
                  'It is saved even when your browser sends Global Privacy Control, because tapping Show Map is your clear choice. It is never sent to us.',
                ],
              ],
            },
          ],
        },
        { kind: 'h3', text: 'Google' },
        {
          kind: 'p',
          parts: [
            'Google may set its own cookies when the map loads. We do not set or control them, so they are not listed above. To see what they do and how long they last, read ',
            {
              text: "Google's cookie policy",
              href: 'https://policies.google.com/technologies/cookies',
              external: true,
            },
            '.',
          ],
        },
        { kind: 'h3', text: 'How to clear them' },
        {
          kind: 'p',
          parts: [
            "You can clear cookies and site data in your browser's settings. This also removes the saved map setting, so the map asks for your tap again, and it signs staff out.",
          ],
        },
        { kind: 'h3', text: 'Global Privacy Control' },
        {
          kind: 'p',
          parts: [
            'Global Privacy Control is a signal that some browsers send to ask websites not to track you. This website tracks no one, so it honors the signal by default.',
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
              parts: ['You can say no to some uses of your information.'],
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
