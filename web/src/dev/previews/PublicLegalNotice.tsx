// Dev-only (plan 12-29; never shipped, D-20): the DRAFT notice of a legal page lives in the public module, not in an
// `@/components` barrel, so the kit gets it from here for the legal-notice scenario. LegalPage and LEGAL_PAGES come along
// although no scenario names them: the showcase then reaches the same modules as the legal pages, so the bundler keeps
// their shared chunk whole. With LegalNotice alone it split off a chunk of its own and each legal page grew about 0.42 KB
// (D-42); the kit takes only the components.
export { LegalNotice } from '@/modules/public/components/LegalNotice';
export { LegalPage } from '@/modules/public/components/LegalPage';
export { LEGAL_PAGES } from '@/modules/public/legalPages';
