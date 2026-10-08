// The axe rule tags for component tests (src/test/axe.ts) and page tests (the @axe-core/playwright fixture, plan
// 02-09): WCAG 2.0, 2.1 and 2.2, levels A and AA (D-18, A11Y-01).
export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] as const;
