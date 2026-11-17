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
  ],
};
