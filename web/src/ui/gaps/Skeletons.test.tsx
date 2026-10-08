// WEB-06, A11Y-01 (02-UI-SPEC SPEC-GAP "Skeleton family + LoadingRegion"; App. E.8 skeleton order card): first-load
// placeholders that keep the final layout and stay out of the accessibility tree.
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { SkeletonCard, SkeletonImage, SkeletonTable, SkeletonText } from './Skeletons';

function sizes(container: Element): { width: string; height: string; radius: string }[] {
  return [...container.querySelectorAll<HTMLElement>('.csp-skel')].map((skel) => ({
    width: skel.style.width,
    height: skel.style.height,
    radius: skel.style.borderRadius,
  }));
}

describe('SkeletonText', () => {
  it('renders 3 lines 14px high at 100%, 90% and 60%, 8px apart, aria-hidden', async () => {
    const { container } = render(<SkeletonText />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute('aria-hidden', 'true');
    expect(root.style.display).toBe('grid');
    expect(root.style.gap).toBe('8px');
    expect(sizes(container)).toEqual([
      { width: '100%', height: '14px', radius: '' },
      { width: '90%', height: '14px', radius: '' },
      { width: '60%', height: '14px', radius: '' },
    ]);
    await expectNoAxeViolations(container);
  });
});

describe('SkeletonCard (App. E.8)', () => {
  it('reproduces the order-card skeleton: a 180px radius-0 media block, then 40%, 75%, 55% and a 56px block', async () => {
    const { container } = render(<SkeletonCard />);
    const card = container.firstElementChild as HTMLElement;
    expect(card).toHaveClass('csp-card');
    expect(card.style.overflow).toBe('hidden');
    expect(card).toHaveAttribute('aria-hidden', 'true');
    const media = card.firstElementChild as HTMLElement;
    expect(media).toHaveClass('csp-skel');
    const body = card.lastElementChild as HTMLElement;
    expect(body.style.padding).toBe('16px');
    expect(body.style.display).toBe('grid');
    expect(body.style.gap).toBe('10px');
    expect(sizes(container)).toEqual([
      { width: '100%', height: '180px', radius: '0px' },
      { width: '40%', height: '14px', radius: '' },
      { width: '75%', height: '22px', radius: '' },
      { width: '55%', height: '14px', radius: '' },
      { width: '100%', height: '56px', radius: '' },
    ]);
    await expectNoAxeViolations(container);
  });
});

describe('SkeletonImage', () => {
  it('reserves the aspect ratio (4 / 3 by default) with a full-box radius-0 skeleton, aria-hidden', async () => {
    const { container, rerender } = render(<SkeletonImage />);
    const box = container.firstElementChild as HTMLElement;
    expect(box).toHaveAttribute('aria-hidden', 'true');
    expect(box.style.aspectRatio).toBe('4 / 3');
    expect(sizes(container)).toEqual([{ width: '100%', height: '100%', radius: '0px' }]);
    await expectNoAxeViolations(container);
    rerender(<SkeletonImage ratio="1 / 1" />);
    expect((container.firstElementChild as HTMLElement).style.aspectRatio).toBe('1 / 1');
  });
});

describe('SkeletonTable', () => {
  it('renders the table layout inside .s-rt-wrap, aria-hidden, with 4 rows unless told otherwise', () => {
    const columns = [
      { key: 'user', header: 'User', lead: true },
      { key: 'total', header: 'Total', money: true },
      { key: 'actions', header: 'Actions', actions: true },
    ];
    const { container, rerender } = render(<SkeletonTable columns={columns} />);
    const wrap = container.firstElementChild;
    expect(wrap).toHaveClass('s-rt-wrap');
    expect(wrap).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(4);
    const cells = container.querySelectorAll('tbody tr:first-child td');
    expect(cells[0]).toHaveClass('is-lead');
    expect(cells[1]).toHaveClass('r', 'm');
    expect(cells[2]).toHaveClass('r', 'is-acts');
    expect(container.querySelectorAll('td:not([data-label])')).toHaveLength(0);
    expect(container.querySelectorAll('th')[2]?.innerHTML).toBe('<span class="csp-sr">Actions</span>');
    rerender(<SkeletonTable columns={columns} rows={2} />);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
  });
});
