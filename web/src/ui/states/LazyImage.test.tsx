import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { kit } from '@/dev/kit';
import { renderNode } from '@/dev/renderScenario';
import { scenarios as statesScenarios } from '@/dev/scenarios/groups/states';
import { expectNoAxeViolations } from '@/test/axe';
import { LazyImage, type LazyImageProps } from '@/ui/states';

// LazyImage (SPEC-GAP, plan 02-28; UI-SPEC "SPEC-GAP Primitive Specs" → LazyImage, UI considerations empty, loading
// and error | LazyImage; WEB-06, A11Y-01, PERF-02, T-02-63). A box with a reserved aspect ratio (through --ratio, D-33)
// so CLS stays below 0.05, a full-box radius-0 Skeleton until the image loads, and the chip-less MediaPlaceholder when
// it fails. jsdom never loads images, so the tests fire `load` and `error` themselves. axe on real timers (L-24).

const SRC = 'https://res.cloudinary.com/csps/image/upload/v1/orders/ord-2026-0148-front.jpg';
const ALT = 'Brgy. San Roque Ballers jersey, front';

// The box: relative and clipped, its height from the aspect ratio.
const BOX = 'relative overflow-hidden aspect-(--ratio)';
// The image fills the box and is cropped to it.
const IMG = 'block size-full object-cover';

function tokens(classes: string | null | undefined): string[] {
  return (classes ?? '').split(/\s+/).filter(Boolean).sort();
}

function image(overrides: Partial<LazyImageProps> = {}) {
  return <LazyImage src={SRC} alt={ALT} width={800} height={600} {...overrides} />;
}

function imgOf(container: Element): HTMLImageElement {
  const img = container.querySelector('img');
  if (img === null) {
    throw new Error('no img rendered');
  }
  return img;
}

function box(container: Element): HTMLElement {
  const element = container.firstElementChild;
  if (!(element instanceof HTMLElement)) {
    throw new Error('nothing rendered');
  }
  return element;
}

/** The loading Skeleton: the only element carrying --sk-h. */
function skeleton(container: Element): HTMLElement | null {
  return (
    [...container.querySelectorAll<HTMLElement>('span')].find((span) => span.style.getPropertyValue('--sk-h') !== '') ??
    null
  );
}

/** The fallback MediaPlaceholder: the inner element named "No image yet". */
function placeholder(container: Element): HTMLElement | null {
  return container.querySelector<HTMLElement>('[aria-label="No image yet"]');
}

describe('LazyImage markup', () => {
  it('renders a lazy, async-decoded img with width, height and alt inside a 4 / 3 box', async () => {
    const { container } = render(image());
    const img = imgOf(container);
    expect(img).toHaveAttribute('src', SRC);
    expect(img).toHaveAttribute('alt', ALT);
    expect(img).toHaveAttribute('width', '800');
    expect(img).toHaveAttribute('height', '600');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
    expect(img).not.toHaveAttribute('fetchpriority');
    expect(tokens(img.className)).toEqual(tokens(IMG));
    expect(tokens(box(container).className)).toEqual(tokens(BOX));
    expect(box(container).style.getPropertyValue('--ratio')).toBe('4 / 3');
    expect(box(container).style.length).toBe(1);
    await expectNoAxeViolations(container);
  });

  it('loads eagerly with fetchpriority high for an LCP image (priority)', () => {
    const { container } = render(image({ priority: true }));
    const img = imgOf(container);
    expect(img).toHaveAttribute('loading', 'eager');
    expect(img).toHaveAttribute('fetchpriority', 'high');
    expect(img).toHaveAttribute('decoding', 'async');
  });

  it('passes a caller class (layout glue) to the box', () => {
    const { container } = render(image({ className: 'mb-4' }));
    expect(tokens(box(container).className)).toEqual(tokens(`${BOX} mb-4`));
  });
});

describe('LazyImage loading', () => {
  it('shows a full-box radius-0 Skeleton over the image until the load event, then only the image', () => {
    const { container } = render(image());
    const skel = skeleton(container);
    expect(skel).not.toBeNull();
    expect(skel).toHaveAttribute('aria-hidden', 'true');
    expect(skel?.style.getPropertyValue('--sk-w')).toBe('100%');
    expect(skel?.style.getPropertyValue('--sk-h')).toBe('100%');
    expect(skel?.style.getPropertyValue('--sk-r')).toBe('0px');
    expect(skel).toHaveClass('absolute', 'inset-0');
    expect(skel?.parentElement).toBe(box(container));
    fireEvent.load(screen.getByRole('img', { name: ALT }));
    expect(skeleton(container)).toBeNull();
    expect(imgOf(container)).toHaveAttribute('src', SRC);
    expect(box(container).style.getPropertyValue('--ratio')).toBe('4 / 3');
  });
});

describe('LazyImage error', () => {
  it('shows the chip-less MediaPlaceholder in the same box after an error, and the box is an image named by the alt', async () => {
    const { container } = render(image());
    fireEvent.error(imgOf(container));
    expect(container.querySelector('img')).toBeNull();
    expect(skeleton(container)).toBeNull();
    const fallback = placeholder(container);
    expect(fallback).not.toBeNull();
    expect(fallback?.parentElement).toBe(box(container));
    expect(fallback?.textContent).toBe('');
    expect(fallback).toHaveClass('aspect-(--ratio)', 'h-full');
    expect(fallback?.style.getPropertyValue('--ratio')).toBe('4 / 3');
    expect(box(container)).toHaveAttribute('role', 'img');
    expect(box(container)).toHaveAttribute('aria-label', ALT);
    expect(box(container)).not.toHaveAttribute('aria-hidden');
    expect(box(container).style.getPropertyValue('--ratio')).toBe('4 / 3');
    expect(screen.getByRole('img', { name: ALT })).toBe(box(container));
    await expectNoAxeViolations(container);
  });

  it('gives a failed decorative image (empty alt) no role and hides it from assistive tech', async () => {
    const { container } = render(image({ alt: '' }));
    expect(imgOf(container)).toHaveAttribute('alt', '');
    expect(box(container)).not.toHaveAttribute('aria-hidden');
    fireEvent.error(imgOf(container));
    expect(box(container)).not.toHaveAttribute('role');
    expect(box(container)).not.toHaveAttribute('aria-label');
    expect(box(container)).toHaveAttribute('aria-hidden', 'true');
    expect(placeholder(container)).not.toBeNull();
    await expectNoAxeViolations(container);
  });

  it('keeps a caller ratio in every state', () => {
    const { container } = render(image({ ratio: '1 / 1' }));
    expect(box(container).style.getPropertyValue('--ratio')).toBe('1 / 1');
    fireEvent.error(imgOf(container));
    expect(box(container).style.getPropertyValue('--ratio')).toBe('1 / 1');
    expect(placeholder(container)?.style.getPropertyValue('--ratio')).toBe('1 / 1');
  });

  it('starts over with a skeleton when the source changes', () => {
    const { container, rerender } = render(image());
    fireEvent.error(imgOf(container));
    rerender(image({ src: `${SRC}?v=2` }));
    expect(imgOf(container)).toHaveAttribute('src', `${SRC}?v=2`);
    expect(skeleton(container)).not.toBeNull();
    expect(box(container)).not.toHaveAttribute('role');
  });
});

describe('LazyImage re-render (React Compiler cache)', () => {
  it('keeps its markup when re-rendered with equal props, loaded or failed', () => {
    const { container, rerender } = render(image());
    fireEvent.load(imgOf(container));
    const loaded = container.innerHTML;
    rerender(image());
    expect(container.innerHTML).toBe(loaded);
    rerender(image({ src: `${SRC}?v=3` }));
    fireEvent.error(imgOf(container));
    const failed = container.innerHTML;
    expect(failed).not.toBe(loaded);
    rerender(image({ src: `${SRC}?v=3` }));
    expect(container.innerHTML).toBe(failed);
  });
});

describe('LazyImage scenarios (the states group)', () => {
  const ids = ['lazy-image-loading', 'lazy-image-error'];
  const cases = statesScenarios.filter((scenario) => ids.includes(scenario.id));

  it('declares them implementation only, at rest, both themes, every width', () => {
    expect(cases.map((scenario) => scenario.id)).toEqual(ids);
    for (const scenario of cases) {
      expect(scenario.group, scenario.id).toBe('states');
      expect(scenario.parity, scenario.id).toBe(false);
      expect(scenario.responsive, scenario.id).toBe(true);
      expect(scenario.states, scenario.id).toEqual(['rest']);
      expect(scenario.themes, scenario.id).toEqual(['light', 'dark']);
    }
  });

  it('holds one image loading (its skeleton) and one failed (named by the alt), with no request and no axe violations', async () => {
    const { container } = render(
      <div>
        {cases.map((scenario) => (
          <div key={scenario.id} data-case={scenario.id}>
            {renderNode(kit, scenario.node, scenario.handlers ?? [])}
          </div>
        ))}
      </div>,
    );
    const loading = container.querySelector('[data-case="lazy-image-loading"]');
    const failed = container.querySelector('[data-case="lazy-image-error"]');
    if (loading === null || failed === null) {
      throw new Error('missing case');
    }
    expect(skeleton(loading)).not.toBeNull();
    expect(imgOf(loading).getAttribute('src')).toMatch(/^data:image\/gif;base64,/);
    // The loading case ignores a load event that reaches its frame.
    fireEvent.load(imgOf(loading));
    expect(skeleton(loading)).not.toBeNull();
    expect(failed.querySelector('img')).toBeNull();
    expect(placeholder(failed)).not.toBeNull();
    expect(screen.getByRole('img', { name: ALT })).toBe(failed.querySelector('[role="img"]'));
    await expectNoAxeViolations(container);
  });
});
