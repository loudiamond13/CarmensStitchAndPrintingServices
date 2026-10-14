// The single `@/ui` import surface (WEB-06, WEB-02, PRD §9.2; UI-SPEC "Component Inventory"). Feature code imports
// every primitive from here, so this test pins the export list: the 37 App. D.3 component names, the six App. D.3
// constants and hooks, the SPEC-GAP primitives, and the `@/lib/csps` helpers App. D.3 re-exports. Each export must be
// the very object its area barrel exports (one implementation, never a second copy).
import { describe, expect, it } from 'vitest';
import * as csps from '@/lib/csps';
import * as ui from './index';

const uiAreas = import.meta.glob<Readonly<Record<string, unknown>>>('./*/index.ts', { eager: true });

/** The App. D.3 component names (`awk '/^## Appendix D.3/,/^## Appendix D.4/' CSPS-UI-SPEC.md | grep -cE '^export function'`). */
const D3_COMPONENTS = [
  'LinkProvider',
  'UiLink',
  'ButtonLink',
  'Icon',
  'Mark',
  'Logo',
  'StitchDivider',
  'SectionCut',
  'MediaPlaceholder',
  'Button',
  'Badge',
  'StatusBadge',
  'Avatar',
  'Field',
  'PasswordField',
  'Select',
  'SegmentedControl',
  'Tabs',
  'ImageUploader',
  'Money',
  'KpiCard',
  'OrderTotals',
  'OrderCard',
  'DataTable',
  'IncomeExpenseChart',
  'Modal',
  'ConfirmDialog',
  'Toast',
  'SiteHeader',
  'Sidebar',
  'Topbar',
  'CategoryCard',
  'ProcessSteps',
  'TestimonialCard',
  'EmptyState',
  'Skeleton',
  'ToastProvider',
] as const;

/** The App. D.3 exported constants (tables) and the one hook. */
const D3_CONSTANTS = ['STATUS_TONE', 'PAYMENT_TONE', 'EXPENSE_TONE', 'SITE_LINKS', 'ADMIN_NAV'] as const;

/** The SPEC-GAP primitives Phase 2 adds (UI-SPEC "New in Phase 2"), plus the Overlay region of the dialogs. */
const SPEC_GAP_COMPONENTS = [
  'ResponsiveTable',
  'Pagination',
  'SearchBox',
  'FilterBar',
  'MoneyInput',
  'OtpInput',
  'LazyImage',
  'ErrorState',
  'SkeletonText',
  'SkeletonCard',
  'SkeletonTable',
  'SkeletonImage',
  'LoadingRegion',
  'Checkbox',
  'SkipLink',
  'MobileNavDrawer',
  'UserMenu',
  'Overlay',
] as const;

const exports: Readonly<Record<string, unknown>> = ui;

describe('@/ui barrel (WEB-06, WEB-02)', () => {
  it('lists exactly 37 App. D.3 component names', () => {
    expect(new Set(D3_COMPONENTS).size).toBe(37);
  });

  it.each(D3_COMPONENTS)('exports the App. D.3 component %s', (name) => {
    expect(typeof exports[name]).toBe('function');
  });

  it.each(D3_CONSTANTS)('exports the App. D.3 constant %s', (name) => {
    expect(exports[name]).toBeTypeOf('object');
    expect(exports[name]).not.toBeNull();
  });

  it('exports the useToast hook', () => {
    expect(typeof exports.useToast).toBe('function');
  });

  it.each(SPEC_GAP_COMPONENTS)('exports the SPEC-GAP primitive %s', (name) => {
    expect(typeof exports[name]).toBe('function');
  });

  it('re-exports every area barrel export as the same object (no second implementation)', () => {
    const areaPaths = Object.keys(uiAreas);
    expect(areaPaths.length).toBeGreaterThanOrEqual(15);
    for (const path of areaPaths) {
      for (const [name, value] of Object.entries(uiAreas[path] ?? {})) {
        expect({ path, name, same: exports[name] === value }).toEqual({ path, name, same: true });
      }
    }
  });

  it('re-exports the @/lib/csps helpers as App. D.3 does', () => {
    for (const [name, value] of Object.entries(csps)) {
      expect({ name, same: exports[name] === value }).toEqual({ name, same: true });
    }
    expect(typeof exports.formatPeso).toBe('function');
    expect(typeof exports.cascadeSentence).toBe('function');
  });
});
