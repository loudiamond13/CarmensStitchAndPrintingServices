// SPEC-GAP: the Cookie Policy draft (UI-SPEC L3; LEGAL-02, D-17, D-19, D-20, D-22, D-36, D-39, D-41). Plain English, drafted for the
// owner's review (D-09). Every cookie the server sets is listed with its exact name, and cookie-inventory.node.test.ts keeps the list
// equal to the cookie name constants in the C# code. Lifetimes are the ones in that code: the consent and visitor cookies last 12
// months from the choice (ConsentCookie.LifetimeMonths), the staff sign-in 90 days when kept (SessionSettings.PersistentLifetime) and
// 12 hours when not, the sign-in code step 30 minutes (TwoFactorSettings.ChallengeLifetime). The version, date and approval flag come
// from legalPages.ts; the version is the consent policy version.
import type { LegalText } from './legalContent';
import { LEGAL_PAGES } from './legalPages';

export const COOKIES_TEXT: LegalText = {
  meta: LEGAL_PAGES.cookies,
  sections: [
    {
      id: 'what-cookies-are',
      heading: 'What cookies are',
      blocks: [
        {
          kind: 'p',
          parts: [
            'A cookie is a small file that a website saves in your browser. It helps the site remember things, such as your choices or that you are signed in.',
          ],
        },
        {
          kind: 'p',
          parts: [
            'Some cookies are needed for the site to work. The others are optional, and we use them only if you say yes.',
          ],
        },
      ],
    },
    {
      id: 'cookies-we-use',
      heading: 'Cookies we use',
      blocks: [
        { kind: 'p', parts: ['This is every cookie our website sets, in three groups.'] },
        { kind: 'h3', text: 'Necessary' },
        {
          kind: 'p',
          parts: ['The site needs these to work. They are always on, and you cannot switch them off here.'],
        },
        {
          kind: 'dl',
          items: [
            {
              term: '__Host-csps_consent',
              parts: ['What it does: Remembers your cookie choice, so we do not ask you again on every visit.'],
              more: [['How long it lasts: 12 months from the day you make your choice.']],
            },
            {
              term: '__Secure-csps_rt',
              parts: [
                'What it does: Staff sign-in only. Keeps a staff member signed in to the admin area. Visitors never get this cookie.',
              ],
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
                'What it does: Staff sign-in only. Tells the site that this browser belongs to signed-in staff, so staff visits are left out of the visitor stats.',
              ],
              more: [
                [
                  'How long it lasts: The same as the staff sign-in: until the browser closes, or 90 days if the staff member chose "Keep me signed in".',
                ],
              ],
            },
            {
              term: 'Admin settings in this browser',
              parts: [
                'What it does: Staff only. Saves the admin theme and the orders view that a staff member picked, in this browser only. It is not sent to us, and it is not a cookie.',
              ],
              more: [['How long it lasts: Until it is changed or cleared. Clearing your cookies and data removes it.']],
            },
          ],
        },
        { kind: 'h3', text: 'Visitor stats' },
        {
          kind: 'p',
          parts: [
            'These are off until you allow them. If you say no, we only count the page and the day, with no visitor id.',
          ],
        },
        {
          kind: 'dl',
          items: [
            {
              term: '__Secure-csps_vid',
              parts: [
                'What it does: A random visitor id. It lets us count how many different people visit and which pages they open. It holds no name or contact details, and only our visitor stats service can read it.',
              ],
              more: [['How long it lasts: 12 months from the day you say yes.']],
            },
          ],
        },
        { kind: 'h3', text: 'Google map' },
        {
          kind: 'p',
          parts: [
            'The Contact page can show a Google map. It loads only if you allow it, or when you tap Show Map for that one visit.',
          ],
        },
        {
          kind: 'p',
          parts: [
            'Google sets its own cookies when the map loads. We do not set or control them, so they are not in the list above. To see what they do and how long they last, read ',
            {
              text: "Google's cookie policy",
              href: 'https://policies.google.com/technologies/cookies',
              external: true,
            },
            '.',
          ],
        },
      ],
    },
    {
      id: 'your-choices',
      heading: 'Your choices',
      blocks: [
        {
          kind: 'p',
          parts: [
            'The first time you visit, we ask which optional cookies you allow. You can change your choice at any time.',
          ],
        },
        {
          kind: 'ul',
          items: [
            ['Visitor stats: allow or refuse. If you refuse, we only count the page and the day.'],
            ['Google map: allow or refuse. If you refuse, the map loads only when you tap Show Map.'],
            ['Necessary cookies stay on, because the site needs them.'],
          ],
        },
        { kind: 'p', parts: ['We ask again after 12 months, or sooner if this policy changes.'] },
        {
          kind: 'p',
          parts: [
            'You can also block or delete cookies in your browser settings. If you block the necessary cookies, we cannot remember your choice, and staff cannot sign in.',
          ],
        },
        {
          kind: 'p',
          parts: [
            'To change your choice now, press the button below, or use Cookie Settings at the bottom of any page.',
          ],
        },
      ],
    },
    {
      id: 'global-privacy-control',
      heading: 'Global Privacy Control',
      blocks: [
        {
          kind: 'p',
          parts: ['Global Privacy Control (GPC) is a browser setting that tells websites not to track you.'],
        },
        {
          kind: 'p',
          parts: [
            'If your browser sends GPC, we read it as a no to visitor stats. We show no cookie bar. You can still allow the Google map in Cookie Settings.',
          ],
        },
        {
          kind: 'p',
          parts: [
            'We say that we honor GPC in ',
            { text: 'our GPC statement', href: '/.well-known/gpc.json', external: true },
            '.',
          ],
        },
      ],
    },
    {
      id: 'clear-your-cookies-and-data',
      heading: 'Clear your cookies and data',
      blocks: [
        {
          kind: 'p',
          parts: ['Cookie Settings has a Clear My Cookies & Data button. When you press it and confirm:'],
        },
        {
          kind: 'ul',
          items: [
            [
              'It deletes the optional cookies and saved settings in this browser, and the visit records linked to them on our server.',
            ],
            ['The necessary cookies stay, so a signed-in staff member stays signed in.'],
            ['It turns visitor stats and the Google map off, and the cookie bar does not ask again.'],
            ["It also resets a staff member's admin theme and orders view in that browser."],
          ],
        },
        {
          kind: 'p',
          parts: ['It leaves the daily totals. They have no visitor id, so they cannot be linked to you.'],
        },
        {
          kind: 'p',
          parts: ["It cannot clear Google's own cookies. To remove those, use your browser settings."],
        },
        { kind: 'p', parts: ['If you never press it, we keep these:'] },
        {
          kind: 'dl',
          items: [
            {
              term: 'Visit records linked to a visitor id',
              parts: ['Kept for about 13 months; removed at the next monthly cleanup.'],
            },
            {
              term: 'Your cookie choice',
              parts: ['Kept for about 13 months; removed at the next monthly cleanup.'],
            },
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
            'When we change this policy, we publish a new version with a reviewed release. Every visitor is then asked for their choice again.',
          ],
        },
        {
          kind: 'p',
          parts: ['The version and the date of the last update are shown at the top of this page.'],
        },
      ],
    },
    {
      id: 'contact-us',
      heading: 'Contact us',
      blocks: [
        { kind: 'p', parts: ['If you have a question about cookies, contact us:'] },
        { kind: 'facts', show: ['contact'] },
      ],
    },
  ],
};
