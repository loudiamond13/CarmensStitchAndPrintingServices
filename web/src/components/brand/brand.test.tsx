import { render, screen } from '@testing-library/react';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { kit } from '@/dev/kit';
import { renderNode } from '@/dev/renderScenario';
import { scenarios as brandScenarios } from '@/dev/scenarios/groups/brand';
import { expectNoAxeViolations } from '@/test/axe';
import * as brand from '@/components/brand';
import { Logo, Mark, type IconName } from '@/components/brand';
import type { ScenarioNode, ScenarioValue } from '@/dev/scenarios/types';
import { ICONS } from './icons';

// The converted App. D.3 Mark and Logo (plan 02-18). The look itself is proven by the parity suite (web/visual,
// `--grep @brand`); these tests pin the markup, the JSX drawing (no raw HTML string, WEB-02), the theme colour hooks,
// the props API and the brand scenario set the parity suite compares.

const LOGO_NAME = "CSPS: Carmen's Stitch & Printing Services";
const RING = 'var(--csp-mark-ring, #572e2b)';
const STITCH = 'var(--csp-mark-stitch, #f6dfd1)';
const MARK_SIZE = { sm: 36, md: 56, lg: 104 } as const;
// The mark keeps App. D.4's whitespace text nodes between its shapes, so text checks on a lockup trim them.

function onlySvg(container: HTMLElement): SVGSVGElement {
  const svgs = container.querySelectorAll('svg');
  expect(svgs).toHaveLength(1);
  const [svg] = svgs;
  if (svg === undefined) {
    throw new Error('no svg');
  }
  return svg;
}

/** The element nodes of a scenario `children` array (an icons-all child is always an Icon node). */
function iconNodes(value: ScenarioValue | undefined): ScenarioNode[] {
  const items: readonly ScenarioValue[] = Array.isArray(value) ? (value as readonly ScenarioValue[]) : [];
  return items.filter(
    (item): item is ScenarioNode =>
      typeof item === 'object' && item !== null && !Array.isArray(item) && 'kind' in item && item.kind === 'node',
  );
}

function classTokens(element: Element | null | undefined): string[] {
  return [...(element?.classList ?? [])];
}

describe('Mark (App. F / D.4 as JSX)', () => {
  it('renders a 512 viewBox svg whose drawing is React children: the tile and seven paths', () => {
    const { container } = render(<Mark />);
    const svg = onlySvg(container);

    expect(svg).toHaveAttribute('viewBox', '0 0 512 512');
    expect(svg).toHaveAttribute('width', '40');
    expect(svg).toHaveAttribute('height', '40');
    expect([...svg.children].map((child) => child.localName)).toEqual([
      'rect',
      'path',
      'path',
      'path',
      'path',
      'path',
      'path',
      'path',
    ]);
    const tile = svg.querySelector('rect');
    expect(tile).toHaveAttribute('width', '512');
    expect(tile).toHaveAttribute('height', '512');
    expect(tile).toHaveAttribute('rx', '118');
    expect(tile).toHaveAttribute('fill', '#ff6600');
  });

  it('reads the ring and the stitch from the --csp-mark-* tokens, with the light colours as fallbacks', () => {
    const { container } = render(<Mark />);
    const paths = [...onlySvg(container).querySelectorAll('path')];

    expect(container.innerHTML).toContain(`fill="${RING}"`);
    expect(paths.map((path) => path.getAttribute('fill'))).toEqual([
      RING,
      'none',
      '#fff6f0',
      null,
      'none',
      RING,
      'none',
    ]);
    for (const stitch of [paths[1], paths[6]]) {
      expect(stitch).toHaveAttribute('stroke', STITCH);
      expect(stitch).toHaveAttribute('stroke-width', '7');
      expect(stitch).toHaveAttribute('stroke-dasharray', '20 13');
      expect(stitch).toHaveAttribute('stroke-linecap', 'round');
    }
  });

  it('draws the needle and its thread in the fixed App. F colours', () => {
    const { container } = render(<Mark />);
    const [, , needle, eye, thread] = [...onlySvg(container).querySelectorAll('path')];

    expect(needle).toHaveAttribute(
      'd',
      'M96.0,470.0 L157.9,404.3 L415.1,93.3 L432.1,65.9 L430.0,54.0 L417.9,54.5 L394.8,77.1 L146.8,395.3 Z',
    );
    expect(needle).toHaveAttribute('stroke', '#ff6600');
    expect(needle).toHaveAttribute('stroke-width', '8');
    expect(needle).toHaveAttribute('paint-order', 'stroke');
    expect(needle).toHaveAttribute('stroke-linejoin', 'round');
    expect(eye).toHaveAttribute('d', 'M372.4,125.7 L411.2,77.4');
    expect(eye).toHaveAttribute('stroke', '#ff6600');
    expect(eye).toHaveAttribute('stroke-width', '9');
    expect(eye).toHaveAttribute('stroke-linecap', 'round');
    expect(thread).toHaveAttribute('stroke', '#ff6600');
    expect(thread).toHaveAttribute('stroke-width', '7');
  });

  it('is decorative without a label and one named image with a label', () => {
    const { container, rerender } = render(<Mark />);
    const svg = onlySvg(container);
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).not.toHaveAttribute('role');

    rerender(<Mark label="CSPS" />);
    expect(screen.getByRole('img', { name: 'CSPS' })).toBe(onlySvg(container));
    expect(onlySvg(container)).not.toHaveAttribute('aria-hidden');
  });

  it('has the .csp-mark look (display block, flex none) and adds a caller class after it', () => {
    const { container } = render(<Mark size={48} className="mb-2" />);
    const svg = onlySvg(container);

    expect(classTokens(svg)).toEqual(expect.arrayContaining(['block', 'flex-none', 'mb-2']));
    expect(svg).toHaveAttribute('width', '48');
    expect(svg).toHaveAttribute('height', '48');
  });

  it('keeps the same svg on an equal-props re-render and resizes on new props', () => {
    const { container, rerender } = render(<Mark size={48} />);
    const first = onlySvg(container);

    rerender(<Mark size={48} />);
    expect(onlySvg(container)).toBe(first);

    rerender(<Mark size={64} label="CSPS" className="mb-2" />);
    expect(onlySvg(container)).toBe(first);
    expect(first).toHaveAttribute('width', '64');
  });
});

describe('Logo ([C]SPS lockup, App. D.3)', () => {
  it.each(['sm', 'md', 'lg'] as const)('renders the %s lockup as one image named for the business', (size) => {
    const { container } = render(<Logo size={size} />);
    const logo = screen.getByRole('img', { name: LOGO_NAME });

    expect(container.querySelectorAll('[role="img"]')).toHaveLength(1);
    const [word, tag] = [...logo.children];
    expect(word).toHaveAttribute('aria-hidden', 'true');
    expect(word?.querySelector('svg')).toHaveAttribute('width', String(MARK_SIZE[size]));
    expect(word?.querySelector('svg')).toHaveAttribute('viewBox', '0 0 512 512');
    expect(word?.textContent.trim()).toBe('SPS');
    expect(tag).toHaveAttribute('aria-hidden', 'true');
    expect(tag?.textContent).toBe("Carmen's Stitch& Printing Services");
    expect(tag?.querySelectorAll('br')).toHaveLength(1);
  });

  it('defaults to the md lockup with the tagline', () => {
    const { container } = render(<Logo />);

    expect(container.querySelector('svg')).toHaveAttribute('width', '56');
    expect(screen.getByRole('img', { name: LOGO_NAME }).children).toHaveLength(2);
  });

  it('drops the tagline with tagline={false} (the expanded admin sidebar)', () => {
    render(<Logo size="sm" tagline={false} />);
    const logo = screen.getByRole('img', { name: LOGO_NAME });

    expect(logo.children).toHaveLength(1);
    expect(logo.textContent.trim()).toBe('SPS');
  });

  it('renders only the mark, at the mark size, for variant="mark"', () => {
    const { container } = render(<Logo size="sm" variant="mark" />);
    const logo = screen.getByRole('img', { name: LOGO_NAME });

    expect(logo.children).toHaveLength(1);
    expect(logo.textContent.trim()).toBe('');
    expect(container.querySelector('svg')).toHaveAttribute('width', '36');
  });

  it('renders the CSPS wordmark with its tagline for variant="wordmark"', () => {
    const { container } = render(<Logo size="lg" variant="wordmark" />);
    const logo = screen.getByRole('img', { name: LOGO_NAME });

    expect(container.querySelector('svg')).toBeNull();
    expect(logo.children[0]).toHaveAttribute('aria-hidden', 'true');
    expect(logo.children[0]?.textContent).toBe('CSPS');
    expect(logo.textContent).toBe("CSPSCarmen's Stitch& Printing Services");
  });

  it.each([
    ['sm', 'gap-3', 'text-[32px]', 'text-[9px]'],
    ['md', 'gap-4', 'text-[50px]', 'text-[11px]'],
    ['lg', 'gap-[22px]', 'text-[92px]', 'text-[15px]'],
  ] as const)('gives the %s lockup its gap, letter size and tagline size (App. B)', (size, gap, letters, tagline) => {
    render(<Logo size={size} />);
    const logo = screen.getByRole('img', { name: LOGO_NAME });
    const [word, tag] = [...logo.children];

    expect(classTokens(logo)).toContain(gap);
    expect(classTokens(word)).toContain(letters);
    expect(classTokens(word?.querySelector('svg + span'))).toContain(letters);
    expect(classTokens(tag)).toContain(tagline);
  });

  it('has no axe violations in every size and variant (A11Y-01)', async () => {
    const { container } = render(
      <div>
        <Logo size="sm" />
        <Logo size="md" />
        <Logo size="lg" />
        <Logo size="sm" tagline={false} />
        <Logo size="sm" variant="mark" />
        <Logo size="md" variant="wordmark" />
        <Mark size={48} />
        <Mark size={48} label="CSPS" />
      </div>,
    );

    await expectNoAxeViolations(container);
  });

  it('keeps the same element on an equal-props re-render and updates on new props', () => {
    const { rerender } = render(<Logo size="sm" />);
    const first = screen.getByRole('img', { name: LOGO_NAME });

    rerender(<Logo size="sm" />);
    expect(screen.getByRole('img', { name: LOGO_NAME })).toBe(first);

    rerender(<Logo size="lg" tagline={false} className="mb-2" />);
    expect(screen.getByRole('img', { name: LOGO_NAME })).toBe(first);
    expect(classTokens(first)).toEqual(expect.arrayContaining(['gap-[22px]', 'mb-2']));
    expect(first.children).toHaveLength(1);
  });
});

describe('Brand scenarios (the brand parity group)', () => {
  const lockups = brandScenarios.filter((scenario) => ['Logo', 'Mark'].includes(scenario.node.component));

  it('declares the three lockup sizes, the sidebar forms, the wordmark and the 48px mark', () => {
    expect(lockups.map((scenario) => scenario.id)).toEqual([
      'logo-sm',
      'logo-md',
      'logo-lg',
      'logo-sm-no-tagline',
      'logo-mark-sm',
      'logo-wordmark-md',
      'mark-48',
    ]);
  });

  it('compares every lockup at rest in both themes, at the shared widths only', () => {
    for (const scenario of lockups) {
      expect(scenario.group, scenario.id).toBe('brand');
      expect(scenario.themes, scenario.id).toEqual(['light', 'dark']);
      expect(scenario.states, scenario.id).toEqual(['rest']);
      expect(scenario.responsive, scenario.id).toBe(false);
      expect(scenario.parity, scenario.id).toBe(true);
    }
  });

  it('renders every lockup scenario through the implementation kit with no axe violations', async () => {
    const { container } = render(
      <div>
        {lockups.map((scenario) => (
          <div key={scenario.id} data-case={scenario.id}>
            {renderNode(kit, scenario.node, scenario.handlers ?? [])}
          </div>
        ))}
      </div>,
    );

    for (const scenario of lockups) {
      const frame = container.querySelector(`[data-case="${scenario.id}"]`);
      expect(frame?.querySelectorAll('svg[viewBox="0 0 512 512"]'), scenario.id).toHaveLength(
        scenario.id === 'logo-wordmark-md' ? 0 : 1,
      );
    }
    expect(container.querySelector('[data-case="mark-48"] svg')).toHaveAttribute('width', '48');
    await expectNoAxeViolations(container);
  });
});

describe('the brand barrel', () => {
  it('exports Icon next to the brand and motif components', () => {
    expect(Object.keys(brand).sort()).toEqual([
      'Icon',
      'Logo',
      'Mark',
      'MediaPlaceholder',
      'SectionCut',
      'StitchDivider',
    ]);
    expectTypeOf<IconName>().toEqualTypeOf<keyof typeof ICONS>();
  });
});

describe('the icon grid scenario (icons-all)', () => {
  const iconsAll = brandScenarios.find((scenario) => scenario.id === 'icons-all');
  const icons = iconNodes(iconsAll?.node.props?.children);

  it('renders all 56 spec icons, by name in ICONS order, at the default size, then the size, stroke and label variants', () => {
    const names = icons.map((icon) => icon.props?.name);
    expect(names.slice(0, 56)).toEqual(Object.keys(ICONS));
    expect(new Set(names.slice(0, 56)).size).toBe(56);
    expect(icons.slice(56)).toEqual([
      { kind: 'node', component: 'Icon', props: { name: 'search', size: 16 } },
      { kind: 'node', component: 'Icon', props: { name: 'search', size: 24 } },
      { kind: 'node', component: 'Icon', props: { name: 'search', strokeWidth: 1.5 } },
      { kind: 'node', component: 'Icon', props: { name: 'search', label: 'Search' } },
    ]);
  });

  it('is compared at rest in both themes at the shared widths', () => {
    expect(iconsAll).toMatchObject({
      group: 'brand',
      node: { kind: 'node', component: 'IconSet' },
      themes: ['light', 'dark'],
      states: ['rest'],
      responsive: false,
      parity: true,
    });
  });

  it('renders through the implementation kit as 60 icon wrappers with no axe violations', async () => {
    if (iconsAll === undefined) {
      throw new Error('icons-all is missing');
    }
    const { container } = render(<div data-case="icons-all">{renderNode(kit, iconsAll.node, [])}</div>);

    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelectorAll('svg[viewBox="0 0 24 24"]')).toHaveLength(60);
    expect(screen.getByRole('img', { name: 'Search' })).toHaveAttribute('width', '20');
    await expectNoAxeViolations(container);
  });
});
