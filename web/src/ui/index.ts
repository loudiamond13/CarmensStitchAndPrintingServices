// The single `@/ui` import surface (WEB-06, WEB-02, PRD §9.2; UI-SPEC "Component Inventory"). Feature code imports
// every primitive from here and never re-implements one: the 37 App. D.3 components with their D.3 props API, the
// App. D.3 constants and hook (STATUS_TONE, PAYMENT_TONE, EXPENSE_TONE, SITE_LINKS, ADMIN_NAV, useToast) and the
// Phase 2 SPEC-GAP primitives. Each area barrel is re-exported whole, in alphabetical order; a name two areas both
// exported would be a type error here. src/ui/index.test.ts pins the list.
export * from './actions';
export * from './brand';
export * from './choice';
export * from './data';
export * from './entry';
export * from './feedback';
export * from './forms';
export * from './lists';
export * from './marketing';
export * from './media';
export * from './money';
export * from './navigation';
export * from './overlays';
export * from './states';
export * from './status';
// SPEC-DEVIATION: D.3 re-exports csps; kept (the order math, formatters and domain types stay one import away).
export * from '../lib/csps';
