import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { kit } from '@/dev/kit';
import { renderNode } from '@/dev/renderScenario';
import { scenarios as brandScenarios } from '@/dev/scenarios/groups/brand';
import { expectNoAxeViolations } from '@/test/axe';
import { MediaPlaceholder, SectionCut, StitchDivider } from '@/ui/brand';

// The converted App. D.3 motifs (plan 02-18, CSPS-UI-SPEC.md §5): StitchDivider, SectionCut and MediaPlaceholder. The
// look is proven by the parity suite (`--grep @brand`); these tests pin the markup, the props API, the --ratio custom
// property (the only inline style, UI-SPEC "Inline style rule") and the motif scenarios.

const MESH_IMAGE =
  'bg-[image:radial-gradient(circle_at_1px_1px,color-mix(in_srgb,var(--ink)_9%,transparent)_1px,transparent_1.6px)]';
const CLIP_BOTH = '[clip-path:polygon(0_var(--cut-angle),100%_0,100%_calc(100%_-_var(--cut-angle)),0_100%)]';
const CLIP_TOP = '[clip-path:polygon(0_var(--cut-angle),100%_0,100%_100%,0_100%)]';
const CLIP_BOTTOM = '[clip-path:polygon(0_0,100%_0,100%_calc(100%_-_var(--cut-angle)),0_100%)]';

function classTokens(element: Element | null | undefined): string[] {
  return [...(element?.classList ?? [])];
}

function only(container: HTMLElement, selector: string): HTMLElement {
  const found = container.querySelectorAll<HTMLElement>(selector);
  expect(found, selector).toHaveLength(1);
  const [element] = found;
  if (element === undefined) {
    throw new Error(selector);
  }
  return element;
}

describe('StitchDivider (App. D.3)', () => {
  it('renders an unlabelled separator with the two stitched rules as pseudo-elements', () => {
    render(<StitchDivider />);
    const divider = screen.getByRole('separator');

    expect(divider.localName).toBe('div');
    expect(divider.children).toHaveLength(0);
    expect(classTokens(divider)).toEqual(
      expect.arrayContaining([
        'flex',
        'items-center',
        'gap-3',
        'text-ink-muted',
        'before:flex-1',
        'after:flex-1',
        'before:bg-[image:repeating-linear-gradient(90deg,var(--line-strong)_0_8px,transparent_8px_14px)]',
        'after:bg-[image:repeating-linear-gradient(90deg,var(--line-strong)_0_8px,transparent_8px_14px)]',
      ]),
    );
  });

  it('puts a label between the rules in the display face', () => {
    render(<StitchDivider label="How ordering works" className="my-6" />);
    const divider = screen.getByRole('separator');
    const label = divider.querySelector('span');

    expect(label?.textContent).toBe('How ordering works');
    expect(classTokens(label)).toEqual(
      expect.arrayContaining(['font-display', 'font-bold', 'text-[14px]', 'tracking-[.16em]', 'uppercase']),
    );
    expect(classTokens(divider)).toContain('my-6');
  });
});

describe('SectionCut (App. D.3)', () => {
  it('renders a section with its children inside the inner wrapper', () => {
    const { container } = render(
      <SectionCut>
        <h2>Categories</h2>
      </SectionCut>,
    );
    const section = only(container, 'section');
    const [inner] = [...section.children];

    expect(section.children).toHaveLength(1);
    expect(inner?.localName).toBe('div');
    expect(inner?.querySelector('h2')?.textContent).toBe('Categories');
    expect(classTokens(inner)).toEqual(expect.arrayContaining(['mx-auto', 'max-w-(--container-max)']));
  });

  it('pads by the cut angle, wider from 1024px (the App. B @media rule as lg:)', () => {
    const { container } = render(<SectionCut />);

    expect(classTokens(only(container, 'section'))).toEqual(
      expect.arrayContaining([
        'relative',
        'px-4',
        'py-[calc(var(--space-16)+var(--cut-angle))]',
        'lg:px-6',
        'lg:py-[calc(var(--space-24)+var(--cut-angle))]',
      ]),
    );
  });

  it.each([
    [true, true, CLIP_BOTH],
    [true, false, CLIP_TOP],
    [false, true, CLIP_BOTTOM],
  ])('clips top=%s bottom=%s with its polygon', (top, bottom, clip) => {
    const { container } = render(<SectionCut top={top} bottom={bottom} />);
    const tokens = classTokens(only(container, 'section'));

    expect(tokens).toContain(clip);
    expect(tokens.filter((token) => token.startsWith('[clip-path:'))).toHaveLength(1);
  });

  it('is not clipped with neither cut', () => {
    const { container } = render(<SectionCut top={false} bottom={false} />);

    expect(classTokens(only(container, 'section')).filter((token) => token.startsWith('[clip-path:'))).toEqual([]);
  });

  it('sits on --surface by default and on --accent with --on-accent text for tone="accent"', () => {
    const { container, rerender } = render(<SectionCut />);
    const section = only(container, 'section');
    expect(classTokens(section)).toContain('bg-surface');
    expect(classTokens(section)).not.toContain('text-on-accent');

    rerender(<SectionCut tone="accent" />);
    expect(classTokens(section)).toEqual(expect.arrayContaining(['bg-accent', 'text-on-accent']));
    expect(classTokens(section)).not.toContain('bg-surface');
  });

  it('adds the dot mesh only when asked, and a caller class', () => {
    const { container, rerender } = render(<SectionCut />);
    const section = only(container, 'section');
    expect(classTokens(section)).not.toContain(MESH_IMAGE);

    rerender(<SectionCut mesh className="mt-8" />);
    expect(classTokens(section)).toEqual(expect.arrayContaining([MESH_IMAGE, 'bg-size-[6px_6px]', 'mt-8']));
  });
});

describe('MediaPlaceholder (App. D.3)', () => {
  it('is one image named "No image yet" with the chip, on the 4 / 3 ratio and the dot mesh by default', () => {
    const { container } = render(<MediaPlaceholder />);
    const box = screen.getByRole('img', { name: 'No image yet' });

    expect(box.localName).toBe('div');
    expect(box.style.length).toBe(1);
    expect(box.style.getPropertyValue('--ratio')).toBe('4 / 3');
    expect(classTokens(box)).toEqual(
      expect.arrayContaining(['aspect-(--ratio)', '@container', 'bg-surface-2', MESH_IMAGE, 'bg-size-[6px_6px]']),
    );
    const chip = only(container, '[role="img"] > span');
    expect(chip.textContent).toBe('No image yet');
    expect(chip.querySelector('svg')).toHaveAttribute('width', '16');
    expect(chip.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('sets only the --ratio custom property in its style (strict CSP)', () => {
    render(<MediaPlaceholder ratio="16 / 9" />);
    const box = screen.getByRole('img', { name: 'No image yet' });

    expect(box.getAttribute('style')).toBe('--ratio: 16 / 9;');
  });

  it('names the image after its label, shows the label in the chip, and the hidden outlined number', () => {
    const { container } = render(<MediaPlaceholder label="Team jersey" number={23} ratio="1 / 1" />);
    const box = screen.getByRole('img', { name: 'Team jersey (no image yet)' });
    const [number, chip] = [...box.children];

    expect(number).toHaveAttribute('aria-hidden', 'true');
    expect(number?.textContent).toBe('23');
    expect(classTokens(number)).toEqual(
      expect.arrayContaining(['text-transparent', '[-webkit-text-stroke:2px_var(--line-strong)]']),
    );
    expect(chip?.textContent).toBe('Team jersey');
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);
  });

  it('shows no number for an empty number', () => {
    render(<MediaPlaceholder number="" />);

    expect(screen.getByRole('img', { name: 'No image yet' }).children).toHaveLength(1);
  });

  it('hides the chip with label={false} and keeps the name', () => {
    render(<MediaPlaceholder label={false} number="7" />);
    const box = screen.getByRole('img', { name: 'No image yet' });

    expect(box.children).toHaveLength(1);
    expect(box.textContent).toBe('7');
  });

  it('keeps the same element on an equal-props re-render and updates on new props', () => {
    const { rerender } = render(<MediaPlaceholder label="Team jersey" />);
    const first = screen.getByRole('img', { name: 'Team jersey (no image yet)' });

    rerender(<MediaPlaceholder label="Team jersey" />);
    expect(screen.getByRole('img', { name: 'Team jersey (no image yet)' })).toBe(first);

    rerender(<MediaPlaceholder label={false} ratio="1 / 1" number={5} className="mt-2" />);
    expect(screen.getByRole('img', { name: 'No image yet' })).toBe(first);
    expect(first.style.getPropertyValue('--ratio')).toBe('1 / 1');
    expect(classTokens(first)).toContain('mt-2');
  });
});

describe('motifs: accessibility and memo', () => {
  it('has no axe violations (A11Y-01)', async () => {
    const { container } = render(
      <div>
        <StitchDivider />
        <StitchDivider label="How ordering works" />
        <SectionCut>
          <p>Categories</p>
        </SectionCut>
        <SectionCut top={false} tone="accent" mesh>
          <p>Get a quote</p>
        </SectionCut>
        <MediaPlaceholder />
        <MediaPlaceholder label="Team jersey" number={23} ratio="1 / 1" />
        <MediaPlaceholder label={false} />
      </div>,
    );

    await expectNoAxeViolations(container);
  });

  it('keeps StitchDivider and SectionCut nodes on equal-props re-renders', () => {
    const { container, rerender } = render(
      <div>
        <StitchDivider label="One" />
        <SectionCut>One</SectionCut>
      </div>,
    );
    const divider = screen.getByRole('separator');
    const section = only(container, 'section');

    rerender(
      <div>
        <StitchDivider label="One" />
        <SectionCut>One</SectionCut>
      </div>,
    );
    expect(screen.getByRole('separator')).toBe(divider);
    expect(only(container, 'section')).toBe(section);

    rerender(
      <div>
        <StitchDivider label="Two" className="my-4" />
        <SectionCut bottom={false} tone="accent" mesh className="mt-4">
          Two
        </SectionCut>
      </div>,
    );
    expect(divider.textContent).toBe('Two');
    expect(section.textContent).toBe('Two');
  });
});

describe('Motif scenarios (the brand parity group)', () => {
  const motifs = brandScenarios.filter((scenario) =>
    ['StitchDivider', 'SectionCut', 'MediaPlaceholder', 'MediaPlaceholderNoChip'].includes(scenario.node.component),
  );

  it('declares the dividers, the four cuts and the four media placeholders', () => {
    expect(motifs.map((scenario) => scenario.id)).toEqual([
      'stitch-divider',
      'stitch-divider-label',
      'section-cut-both',
      'section-cut-top-accent',
      'section-cut-bottom',
      'section-cut-mesh',
      'media-placeholder-4x3',
      'media-placeholder-1x1-label',
      'media-placeholder-16x9-number',
      'media-placeholder-no-chip',
    ]);
  });

  it('compares every motif at rest in both themes at all four widths (responsive)', () => {
    for (const scenario of motifs) {
      expect(scenario.group, scenario.id).toBe('brand');
      expect(scenario.themes, scenario.id).toEqual(['light', 'dark']);
      expect(scenario.states, scenario.id).toEqual(['rest']);
      expect(scenario.responsive, scenario.id).toBe(true);
      expect(scenario.parity, scenario.id).toBe(true);
    }
  });

  it('renders every motif scenario through the implementation kit with no axe violations', async () => {
    const { container } = render(
      <div>
        {motifs.map((scenario) => (
          <div key={scenario.id} data-case={scenario.id}>
            {renderNode(kit, scenario.node, scenario.handlers ?? [])}
          </div>
        ))}
      </div>,
    );

    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelectorAll('section')).toHaveLength(4);
    expect(container.querySelectorAll('[role="separator"]')).toHaveLength(2);
    expect(container.querySelectorAll('[role="img"]')).toHaveLength(4);
    expect(container.querySelector('[data-case="media-placeholder-no-chip"] [role="img"]')?.children).toHaveLength(1);
    await expectNoAxeViolations(container);
  });
});
