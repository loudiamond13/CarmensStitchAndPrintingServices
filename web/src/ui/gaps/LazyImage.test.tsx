// WEB-06, A11Y-01, PERF-02 (02-UI-SPEC SPEC-GAP "LazyImage"; UI considerations empty, loading and error for
// LazyImage): a reserved aspect box, a skeleton until the image loads, and MediaPlaceholder when it fails.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { LazyImage } from './LazyImage';

const SRC = 'https://res.cloudinary.com/csps/image/upload/v1/orders/ord-2026-0148-front.jpg';

function image(overrides: Partial<Parameters<typeof LazyImage>[0]> = {}) {
  return <LazyImage src={SRC} alt="Brgy. San Roque Ballers jersey, front" width={800} height={600} {...overrides} />;
}

function imgOf(container: Element): HTMLImageElement {
  const img = container.querySelector('img');
  if (img === null) {
    throw new Error('no img rendered');
  }
  return img;
}

function box(container: Element): HTMLElement {
  return container.firstElementChild as HTMLElement;
}

describe('LazyImage', () => {
  it('renders a lazy, async-decoded img with width, height and alt inside a 4 / 3 box', async () => {
    const { container } = render(image());
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', SRC);
    expect(img).toHaveAttribute('alt', 'Brgy. San Roque Ballers jersey, front');
    expect(img).toHaveAttribute('width', '800');
    expect(img).toHaveAttribute('height', '600');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
    expect(img).not.toHaveAttribute('fetchpriority');
    expect(box(container)).toHaveClass('csp-lazy');
    expect(box(container).style.aspectRatio).toBe('4 / 3');
    await expectNoAxeViolations(container);
  });

  it('shows a full-box radius-0 Skeleton until the load event, then only the image', () => {
    const { container } = render(image());
    const skel = container.querySelector<HTMLElement>('.csp-skel');
    expect(skel).not.toBeNull();
    expect(skel).toHaveAttribute('aria-hidden', 'true');
    expect(skel?.style.width).toBe('100%');
    expect(skel?.style.height).toBe('100%');
    expect(skel?.style.borderRadius).toBe('0px');
    fireEvent.load(screen.getByRole('img', { name: 'Brgy. San Roque Ballers jersey, front' }));
    expect(container.querySelector('.csp-skel')).toBeNull();
    expect(container.querySelector('img')).toHaveAttribute('src', SRC);
    expect(box(container).style.aspectRatio).toBe('4 / 3');
  });

  it('shows MediaPlaceholder in the same box after an error, named by the alt text', async () => {
    const { container } = render(image());
    fireEvent.error(imgOf(container));
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.csp-skel')).toBeNull();
    const placeholder = box(container).querySelector('.csp-media-ph');
    expect(placeholder).not.toBeNull();
    expect(placeholder?.querySelector('.csp-media-ph-num')).toBeNull();
    expect((placeholder as HTMLElement).style.aspectRatio).toBe('4 / 3');
    expect(box(container)).toHaveAttribute('role', 'img');
    expect(box(container)).toHaveAttribute('aria-label', 'Brgy. San Roque Ballers jersey, front');
    expect(box(container).style.aspectRatio).toBe('4 / 3');
    expect(screen.getByRole('img', { name: 'Brgy. San Roque Ballers jersey, front' })).toBe(box(container));
    await expectNoAxeViolations(container);
  });

  it('gives a failed decorative image (empty alt) no role and hides it from assistive tech', async () => {
    const { container } = render(image({ alt: '' }));
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
    fireEvent.error(imgOf(container));
    expect(box(container)).not.toHaveAttribute('role');
    expect(box(container)).not.toHaveAttribute('aria-label');
    expect(box(container)).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.csp-media-ph')).not.toBeNull();
    await expectNoAxeViolations(container);
  });

  it('loads eagerly with fetchpriority high for an LCP image (priority)', () => {
    const { container } = render(image({ priority: true }));
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('loading', 'eager');
    expect(img).toHaveAttribute('fetchpriority', 'high');
    expect(img).toHaveAttribute('decoding', 'async');
  });

  it('keeps a caller ratio in every state', () => {
    const { container } = render(image({ ratio: '1 / 1' }));
    expect(box(container).style.aspectRatio).toBe('1 / 1');
    fireEvent.error(imgOf(container));
    expect(box(container).style.aspectRatio).toBe('1 / 1');
    expect(box(container).querySelector<HTMLElement>('.csp-media-ph')?.style.aspectRatio).toBe('1 / 1');
  });

  it('starts over with a skeleton when the source changes', () => {
    const { container, rerender } = render(image());
    fireEvent.error(imgOf(container));
    rerender(image({ src: `${SRC}?v=2` }));
    expect(container.querySelector('img')).toHaveAttribute('src', `${SRC}?v=2`);
    expect(container.querySelector('.csp-skel')).not.toBeNull();
    expect(box(container)).not.toHaveAttribute('role');
  });

  it('passes a caller class to the box', () => {
    const { container } = render(image({ className: 'csp-order-media' }));
    expect(box(container)).toHaveClass('csp-lazy', 'csp-order-media');
  });
});
