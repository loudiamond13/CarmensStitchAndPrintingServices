import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { Icon } from '@/ui/brand';

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
});
