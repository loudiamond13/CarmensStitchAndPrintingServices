// SPEC-GAP: the Accessibility Statement draft (UI-SPEC L5; LEGAL-04, D-09, D-10). Plain English, drafted for the owner's review.
// It promises no reply time and no result the site has not been checked for: the owner gives either, and the text changes in a
// reviewed release. The version, date and approval flag come from legalPages.ts.
import type { LegalText } from './legalContent';
import { LEGAL_PAGES } from './legalPages';

export const ACCESSIBILITY_TEXT: LegalText = {
  meta: LEGAL_PAGES.accessibility,
  sections: [
    {
      id: 'our-goal',
      heading: 'Our goal',
      blocks: [
        {
          kind: 'p',
          parts: [
            'We want everyone to be able to use this website, including people who use a keyboard, a screen reader or a magnifier. Our goal is to meet WCAG 2.2 level AA.',
          ],
        },
      ],
    },
    {
      id: 'what-we-do',
      heading: 'What we do',
      blocks: [
        { kind: 'p', parts: ['We build every page with these in mind:'] },
        {
          kind: 'ul',
          items: [
            ['You can use the whole site with a keyboard.'],
            ['Buttons, links and form fields have clear labels for screen readers.'],
            ['Text and background colors have enough contrast.'],
            ['Text can be made larger without losing content.'],
            ['Pages do not move or fade when your device is set to reduce motion.'],
          ],
        },
      ],
    },
    {
      id: 'known-limits',
      heading: 'Known limits',
      blocks: [
        {
          kind: 'p',
          parts: [
            'The Google map comes from Google. We cannot change how it works for people who use a keyboard or a screen reader. The address and a directions link are always on the page.',
          ],
        },
        {
          kind: 'p',
          parts: ['The photo descriptions are short. They say what the photo shows, but not every detail.'],
        },
      ],
    },
    {
      id: 'tell-us-about-a-problem',
      heading: 'Tell us about a problem',
      blocks: [
        { kind: 'p', parts: ['If something on this site is hard to use, please contact us.'] },
        { kind: 'facts', show: ['contact'] },
        { kind: 'p', parts: ['Tell us the page and what went wrong.'] },
        { kind: 'p', parts: ["We'll reply as soon as we can."] },
      ],
    },
    {
      id: 'how-we-check',
      heading: 'How we check',
      blocks: [
        {
          kind: 'p',
          parts: [
            'We run automated accessibility checks on every change to the site. We also test with a keyboard and with a screen reader.',
          ],
        },
        {
          kind: 'p',
          parts: [
            'Automated checks do not find every problem, so we may still miss some. That is why your report helps.',
          ],
        },
      ],
    },
  ],
};
