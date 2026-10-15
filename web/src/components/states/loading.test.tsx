import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { kit } from '@/dev/kit';
import { renderNode } from '@/dev/renderScenario';
import { scenarios as statesScenarios } from '@/dev/scenarios/groups/states';
import { expectNoAxeViolations } from '@/test/axe';
import { skeletonClasses } from '@/components/feedback/feedback.recipe';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { cardClasses } from '@/components/money';
import { LoadingRegion, SkeletonCard, SkeletonImage, SkeletonText, STATES_COPY } from '@/components/states';

// The Skeleton family and LoadingRegion (SPEC-GAP, plan 02-28; UI-SPEC "SPEC-GAP Primitive Specs" → Skeleton family +
// LoadingRegion, App. E.8 skeleton order card, Copywriting "Loading announcement"; WEB-06, A11Y-01). First-load
// placeholders keep the final layout and stay out of the accessibility tree; the region around them says it is busy
// and announces the load politely. Sizes only through --sk-w/--sk-h/--sk-r, ratios only through --ratio (D-33).
// axe on real timers (L-24).

function tokens(classes: string | null | undefined): string[] {
  return (classes ?? '').split(/\s+/).filter(Boolean).sort();
}

interface SkeletonSize {
  width: string;
  height: string;
  radius: string;
}

/** The --sk-* sizes of every Skeleton under `container`, in document order. */
function sizes(container: Element): SkeletonSize[] {
  return [...container.querySelectorAll<HTMLElement>('span[aria-hidden="true"]')]
    .filter((skel) => skel.style.getPropertyValue('--sk-h') !== '')
    .map((skel) => ({
      width: skel.style.getPropertyValue('--sk-w'),
      height: skel.style.getPropertyValue('--sk-h'),
      radius: skel.style.getPropertyValue('--sk-r'),
    }));
}

function first(container: Element): HTMLElement {
  const element = container.firstElementChild;
  if (!(element instanceof HTMLElement)) {
    throw new Error('nothing rendered');
  }
  return element;
}

// SkeletonText: a grid, 8px apart.
const SKELETON_TEXT = 'grid gap-2';
// App. E.8 `<div class="csp-card" style="overflow: hidden">`: the .csp-card look, clipped.
const SKELETON_CARD = `${cardClasses} overflow-hidden`;
// App. E.8 `<div style="padding: 16px; display: grid; gap: 10px">`.
const SKELETON_CARD_BODY = 'grid gap-2.5 p-4';

describe('SkeletonText', () => {
  it('renders 3 lines 14px high at 100%, 90% and 60%, 8px apart, aria-hidden', async () => {
    const { container } = render(<SkeletonText />);
    const root = first(container);
    expect(root).toHaveAttribute('aria-hidden', 'true');
    expect(tokens(root.className)).toEqual(tokens(SKELETON_TEXT));
    expect(sizes(container)).toEqual([
      { width: '100%', height: '14px', radius: '6px' },
      { width: '90%', height: '14px', radius: '6px' },
      { width: '60%', height: '14px', radius: '6px' },
    ]);
    await expectNoAxeViolations(container);
  });

  it('uses the shimmering Skeleton look, which stops under reduced motion (O-6)', () => {
    const { container } = render(<SkeletonText />);
    for (const skel of container.querySelectorAll('span')) {
      expect(tokens(skel.className)).toEqual(tokens(skeletonClasses));
      expect(skel.classList).toContain('animate-csp-shimmer');
      expect(skel.classList).toContain('motion-reduce:animate-none');
    }
  });
});

describe('SkeletonCard (App. E.8 order-card skeleton)', () => {
  it('reproduces it: a 180px radius-0 media block, then 40% and 75% and 55% lines and a 56px block', async () => {
    const { container } = render(<SkeletonCard />);
    const card = first(container);
    expect(card).toHaveAttribute('aria-hidden', 'true');
    expect(tokens(card.className)).toEqual(tokens(SKELETON_CARD));
    expect(card.children).toHaveLength(2);
    const body = card.lastElementChild;
    expect(tokens(body?.className)).toEqual(tokens(SKELETON_CARD_BODY));
    expect(sizes(container)).toEqual([
      { width: '100%', height: '180px', radius: '0px' },
      { width: '40%', height: '14px', radius: '6px' },
      { width: '75%', height: '22px', radius: '6px' },
      { width: '55%', height: '14px', radius: '6px' },
      { width: '100%', height: '56px', radius: '6px' },
    ]);
    expect(body?.children).toHaveLength(4);
    await expectNoAxeViolations(container);
  });
});

describe('SkeletonImage', () => {
  it('reserves the aspect ratio through --ratio (4 / 3 by default) with a full-box radius-0 skeleton, aria-hidden', async () => {
    const { container, rerender } = render(<SkeletonImage />);
    const box = first(container);
    expect(box).toHaveAttribute('aria-hidden', 'true');
    expect(box.classList).toContain('aspect-(--ratio)');
    expect(box.style.getPropertyValue('--ratio')).toBe('4 / 3');
    expect(box.style.length).toBe(1);
    expect(sizes(container)).toEqual([{ width: '100%', height: '100%', radius: '0px' }]);
    await expectNoAxeViolations(container);
    rerender(<SkeletonImage ratio="1 / 1" className="mb-4" />);
    expect(first(container).style.getPropertyValue('--ratio')).toBe('1 / 1');
    expect(first(container)).toHaveClass('aspect-(--ratio)', 'mb-4');
  });
});

describe('LoadingRegion', () => {
  function region(loading: boolean, failed?: boolean) {
    return (
      <LoadingRegion loading={loading} things="orders" className="mt-4" {...(failed === undefined ? {} : { failed })}>
        <SkeletonCard />
      </LoadingRegion>
    );
  }

  function busyRegion(container: Element): Element {
    const element = container.querySelector('.mt-4');
    if (element === null) {
      throw new Error('no region');
    }
    return element;
  }

  it('sets aria-busy="true" on the region and says "Loading orders…" while loading; the skeletons are aria-hidden', async () => {
    const { container } = render(region(true));
    const busy = busyRegion(container);
    expect(busy).toHaveAttribute('aria-busy', 'true');
    expect(busy.querySelector('[aria-hidden="true"]')).not.toBeNull();
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Loading orders…');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(tokens(status.className)).toEqual(tokens(srOnlyClasses));
    await expectNoAxeViolations(container);
  });

  it('speaks the announce words instead of the "Loading {things}…" pair when they are given', () => {
    const tree = (loading: boolean) => (
      <LoadingRegion
        loading={loading}
        things="link"
        announce={{ loading: 'Checking your link…', loaded: 'Link checked.' }}
      >
        <p>Body</p>
      </LoadingRegion>
    );
    const { rerender } = render(tree(true));
    expect(screen.getByRole('status')).toHaveTextContent('Checking your link…');
    rerender(tree(false));
    expect(screen.getByRole('status')).toHaveTextContent('Link checked.');
  });

  it('keeps the status node outside the busy region, so its announcement is not held back', () => {
    const { container } = render(region(true));
    expect(container.querySelector('[aria-busy="true"] [role="status"]')).toBeNull();
    expect(busyRegion(container).nextElementSibling).toBe(screen.getByRole('status'));
  });

  it('removes aria-busy and says "Orders loaded." in the same status node when loading ends', () => {
    const { container, rerender } = render(region(true));
    const status = screen.getByRole('status');
    rerender(region(false));
    expect(busyRegion(container)).not.toHaveAttribute('aria-busy');
    expect(screen.getByRole('status')).toBe(status);
    expect(status).toHaveTextContent('Orders loaded.');
  });

  it('says nothing when it was never loading', async () => {
    const { container, rerender } = render(region(false));
    expect(screen.getByRole('status')).toHaveTextContent('');
    rerender(region(false));
    expect(screen.getByRole('status')).toHaveTextContent('');
    await expectNoAxeViolations(container);
  });

  it('says nothing after a failed load, because the ErrorState banner announces it', () => {
    const { rerender } = render(region(true));
    rerender(region(false, true));
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('announces again on the next load', () => {
    const { rerender } = render(region(true));
    rerender(region(false));
    rerender(region(true));
    expect(screen.getByRole('status')).toHaveTextContent('Loading orders…');
    rerender(region(false));
    expect(screen.getByRole('status')).toHaveTextContent('Orders loaded.');
  });

  it('has exactly one status node in every state', () => {
    const { container, rerender } = render(region(true));
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);
    rerender(region(false));
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);
  });

  it('uses the Copywriting strings from the one copy module', () => {
    expect(STATES_COPY.loading.loading('orders')).toBe('Loading orders…');
    expect(STATES_COPY.loading.loaded('orders')).toBe('Orders loaded.');
    expect(STATES_COPY.loading.loaded('users')).toBe('Users loaded.');
  });
});

describe('state primitives re-render (React Compiler cache)', () => {
  it('keeps every skeleton and the region unchanged when re-rendered with equal props, and updates on new props', () => {
    const tree = (ratio: string) => (
      <>
        <SkeletonText />
        <SkeletonCard />
        <SkeletonImage ratio={ratio} className="mb-4" />
        <LoadingRegion loading={false} things="orders">
          <p>Orders go here</p>
        </LoadingRegion>
      </>
    );
    const { container, rerender } = render(tree('16 / 9'));
    const before = container.innerHTML;
    rerender(tree('16 / 9'));
    expect(container.innerHTML).toBe(before);
    rerender(tree('1 / 1'));
    expect(container.innerHTML).not.toBe(before);
  });
});

describe('skeleton and loading scenarios (the states group)', () => {
  const ids = ['skeleton-text', 'skeleton-card', 'skeleton-image', 'loading-region'];
  const cases = statesScenarios.filter((scenario) => ids.includes(scenario.id));

  it('declares them implementation only, at rest, both themes, every width; the skeletons add the reduced-motion pass', () => {
    expect(cases.map((scenario) => scenario.id)).toEqual(ids);
    for (const scenario of cases) {
      expect(scenario.group, scenario.id).toBe('states');
      expect(scenario.parity, scenario.id).toBe(false);
      expect(scenario.responsive, scenario.id).toBe(true);
      expect(scenario.states, scenario.id).toEqual(['rest']);
      expect(scenario.themes, scenario.id).toEqual(['light', 'dark']);
    }
    expect(cases.filter((scenario) => scenario.passes?.includes('motion')).map((scenario) => scenario.id)).toEqual([
      'skeleton-text',
      'skeleton-card',
      'skeleton-image',
    ]);
  });

  it('every states scenario id is unique and the group holds the plan list', () => {
    expect(statesScenarios.map((scenario) => scenario.id)).toEqual([
      'error-state-orders',
      'error-state-trace',
      'skeleton-text',
      'skeleton-card',
      'skeleton-image',
      'loading-region',
      'lazy-image-loading',
      'lazy-image-error',
    ]);
  });

  it('renders them through the implementation kit: one busy region with its announcement, no axe violations', async () => {
    const { container } = render(
      <div>
        {cases.map((scenario) => (
          <div key={scenario.id} data-case={scenario.id}>
            {renderNode(kit, scenario.node, scenario.handlers ?? [])}
          </div>
        ))}
      </div>,
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(container.querySelectorAll('[aria-busy="true"]')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('Loading orders…');
    expect(sizes(container).length).toBeGreaterThan(0);
    await expectNoAxeViolations(container);
  });
});
