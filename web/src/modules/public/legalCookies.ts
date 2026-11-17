// SPEC-GAP: the Cookie Policy draft (UI-SPEC L3; LEGAL-02, D-17). Starting point: the real text arrives with the tests in plan 12-19.
import type { LegalText } from './legalContent';
import { LEGAL_PAGES } from './legalPages';

export const COOKIES_TEXT: LegalText = {
  meta: LEGAL_PAGES.cookies,
  sections: [
    {
      id: 'what-cookies-are',
      heading: 'What cookies are',
      blocks: [{ kind: 'p', parts: ['A cookie is a small file that a website saves in your browser.'] }],
    },
  ],
};
