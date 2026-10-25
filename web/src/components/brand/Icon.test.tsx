import { render, screen } from '@testing-library/react';
import {
  Archive,
  ArchiveRestore,
  Copy,
  Eraser,
  Funnel,
  History,
  KeyRound,
  LockOpen,
  Minus,
  RotateCcw,
  Settings,
  Trash,
  UserCheck,
  UserX,
} from 'lucide-react';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { Icon, type IconName } from '@/components/brand';
import { ICONS } from './icons';

// The 56 icon names of CSPS-UI-SPEC.md Appendix D.5 (the keys of its ICONS object, line 3899), sorted. The App. D.5
// prose says 57; the object holds 56.
const SPEC_ICON_NAMES = [
  'arrow-right',
  'arrow-up-right',
  'calendar',
  'check',
  'chevron-down',
  'chevron-left',
  'chevron-right',
  'circle-check',
  'clipboard-list',
  'clock',
  'cloud-upload',
  'ellipsis',
  'eye',
  'eye-off',
  'filter',
  'grip-vertical',
  'image',
  'info',
  'layout-dashboard',
  'layout-grid',
  'list',
  'loader-circle',
  'lock',
  'log-out',
  'mail',
  'map-pin',
  'menu',
  'message-circle',
  'moon',
  'package',
  'palette',
  'panel-left-close',
  'panel-left-open',
  'pencil',
  'phone',
  'plus',
  'printer',
  'quote',
  'receipt',
  'ruler',
  'scissors',
  'search',
  'shield-check',
  'shirt',
  'star',
  'sun',
  'trash-2',
  'trending-down',
  'trending-up',
  'triangle-alert',
  'truck',
  'user-round',
  'users',
  'wallet',
  'x',
  'zap',
] as const;

// Not in App. D.5: the owner's empty-value icon (OR-4, 2026-10-14), the six Phase 5 icons (UI-SPEC OQ-9), then the five Phase 6
// icons (UI-SPEC OQ-12).
const OWNER_ICON_NAMES = [
  'minus',
  'copy',
  'lock-open',
  'key-round',
  'user-x',
  'user-check',
  'history',
  'settings',
  'rotate-ccw',
  'archive',
  'archive-restore',
  'eraser',
] as const;

/** The one svg an Icon renders. */
function onlySvg(container: HTMLElement): SVGSVGElement {
  const svgs = container.querySelectorAll('svg');
  expect(svgs).toHaveLength(1);
  const svg = svgs[0];
  if (svg === undefined) {
    throw new Error('no svg rendered');
  }
  return svg;
}

describe('Icon (App. D.3 API over lucide-react, D-10)', () => {
  it('names a labelled icon for assistive technology: role img with the label as its name', () => {
    const { container } = render(<Icon name="plus" label="Add" />);
    const svg = onlySvg(container);
    expect(screen.getByRole('img', { name: 'Add' })).toBe(svg);
    expect(svg).not.toHaveAttribute('aria-hidden');
  });

  it('keeps the spec svg wrapper: 20px by default, stroke width 2, round caps and joins, current colour', () => {
    const svg = onlySvg(render(<Icon name="plus" label="Add" />).container);
    expect(svg).toHaveAttribute('width', '20');
    expect(svg).toHaveAttribute('height', '20');
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    expect(svg).toHaveAttribute('fill', 'none');
    expect(svg).toHaveAttribute('stroke', 'currentColor');
    expect(svg).toHaveAttribute('stroke-width', '2');
    expect(svg).toHaveAttribute('stroke-linecap', 'round');
    expect(svg).toHaveAttribute('stroke-linejoin', 'round');
    expect(svg.querySelectorAll('path').length).toBeGreaterThan(0);
  });

  it('carries the .csp-icon look and keeps lucide’s own classes (D-28)', () => {
    const svg = onlySvg(render(<Icon name="plus" label="Add" />).container);
    expect(svg.classList).toContain('lucide');
    expect(svg.classList).toContain('lucide-plus');
    for (const token of ['flex-none', 'inline-block', 'align-middle']) {
      expect(svg.classList).toContain(token);
    }
  });

  it('hides an unlabelled icon from assistive technology, with no role', () => {
    const svg = onlySvg(render(<Icon name="plus" />).container);
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).not.toHaveAttribute('role');
    expect(svg).not.toHaveAttribute('aria-label');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('sets width and height from size', () => {
    const svg = onlySvg(render(<Icon name="plus" size={16} />).container);
    expect(svg).toHaveAttribute('width', '16');
    expect(svg).toHaveAttribute('height', '16');
  });

  it('passes strokeWidth through and adds a context class beside the wrapper look', () => {
    const svg = onlySvg(render(<Icon name="plus" strokeWidth={1.5} className="text-accent-ink" />).container);
    expect(svg).toHaveAttribute('stroke-width', '1.5');
    expect(svg.classList).toContain('text-accent-ink');
    expect(svg.classList).toContain('flex-none');
  });

  it('has no axe violations when labelled (A11Y-01)', async () => {
    const { container } = render(<Icon name="plus" label="Add" />);
    await expectNoAxeViolations(container);
  });

  it('re-renders from the React Compiler memo cache with the same output, and updates on new props (L-13)', () => {
    const { container, rerender } = render(<Icon name="plus" label="Add" className="text-accent-ink" />);
    const first = container.innerHTML;
    rerender(<Icon name="plus" label="Add" className="text-accent-ink" />);
    expect(container.innerHTML).toBe(first);
    rerender(<Icon name="x" size={16} strokeWidth={1.5} />);
    const svg = onlySvg(container);
    expect(svg.classList).toContain('lucide-x');
    expect(svg).toHaveAttribute('width', '16');
    expect(svg).toHaveAttribute('stroke-width', '1.5');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg.classList).not.toContain('text-accent-ink');
  });

  it('treats an empty label as no label, as App. D.3 does: hidden, never an unnamed image', () => {
    const svg = onlySvg(render(<Icon name="plus" label="" />).container);
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).not.toHaveAttribute('role');
  });
});

describe('ICONS (App. D.5 names, D-32 aliases)', () => {
  it('holds the 56 spec icon names, then the owner icons, no more and no fewer', () => {
    expect(SPEC_ICON_NAMES).toHaveLength(56);
    const keys = Object.keys(ICONS);
    expect(keys.slice(0, 56).sort()).toEqual([...SPEC_ICON_NAMES]);
    expect(keys.slice(56)).toEqual([...OWNER_ICON_NAMES]);
  });

  it('types IconName as the spec names plus the owner icons, so an unknown name is a compile error', () => {
    expectTypeOf<IconName>().toEqualTypeOf<(typeof SPEC_ICON_NAMES)[number] | (typeof OWNER_ICON_NAMES)[number]>();
  });

  it('draws minus with lucide’s Minus (OR-4)', () => {
    expect(ICONS.minus).toBe(Minus);
  });

  it.each([
    ['copy', Copy],
    ['lock-open', LockOpen],
    ['key-round', KeyRound],
    ['user-x', UserX],
    ['user-check', UserCheck],
    ['history', History],
  ] as const)('draws %s with the lucide component of the same name (Phase 5)', (name, component) => {
    expect(ICONS[name]).toBe(component);
  });

  it.each([
    ['settings', Settings],
    ['rotate-ccw', RotateCcw],
    ['archive', Archive],
    ['archive-restore', ArchiveRestore],
    ['eraser', Eraser],
  ] as const)('draws %s with the lucide component of the same name (Phase 6, OQ-12)', (name, component) => {
    expect(ICONS[name]).toBe(component);
  });

  it('renders the History icon as a named image', () => {
    render(<Icon name="history" label="History" />);
    expect(screen.getByRole('img', { name: 'History' })).toBeInTheDocument();
  });

  it('draws trash-2 with lucide’s Trash and filter with lucide’s Funnel (D-32)', () => {
    expect(ICONS['trash-2']).toBe(Trash);
    expect(ICONS.filter).toBe(Funnel);
  });

  it.each([...SPEC_ICON_NAMES, ...OWNER_ICON_NAMES])('renders %s as one lucide svg with a drawing', (name) => {
    const svg = onlySvg(render(<Icon name={name} />).container);
    expect(svg.classList).toContain('lucide');
    expect(svg.childElementCount).toBeGreaterThan(0);
  });
});
