import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { PhotoViewer, type PhotoViewerPhoto } from '@/components/media';

// PhotoViewer (SPEC-GAP, plan 09-04; UI-SPEC P4, D-16, D-04, D-27, IMG-04): the order photo viewer dialog. The photos
// are local data: images only. jsdom never loads images, so the tests fire `load` and `error` themselves.

const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

function photo(n: number, overrides: Partial<PhotoViewerPhoto> = {}): PhotoViewerPhoto {
  return {
    id: `p${String(n)}`,
    alt: `Front mockup ${String(n)}`,
    viewer: {
      src: `${PIXEL}#${String(n)}`,
      srcSet: `${PIXEL}#${String(n)} 640w, ${PIXEL}#${String(n)}b 960w`,
      width: 1200,
      height: 800,
    },
    fullSize: `https://res.cloudinary.com/csps/image/upload/v1/orders/p${String(n)}-full.jpg`,
    ...overrides,
  };
}

const THREE = [photo(1), photo(2), photo(3)];
const SIZES = '(max-width: 639px) calc(100vw - 32px), 956px';

interface HarnessProps {
  photos?: readonly PhotoViewerPhoto[];
  start?: number;
  onClose?: (lastShownId: string) => void;
}

function Harness({ photos = THREE, start = 0, onClose = () => undefined }: HarnessProps) {
  const [index, setIndex] = useState(start);
  return (
    <PhotoViewer
      photos={photos}
      index={index}
      onIndexChange={setIndex}
      onClose={onClose}
      label="Order photos"
      sizes={SIZES}
    />
  );
}

function dialog(): HTMLElement {
  return screen.getByRole('dialog', { name: 'Order photos' });
}

describe('PhotoViewer open, step and close', () => {
  it('opens as a modal dialog named by its label, with focus on Close viewer and the first photo shown', () => {
    render(<Harness />);
    expect(dialog()).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Close viewer' })).toHaveFocus();
    expect(within(dialog()).getByText('Photo 1 of 3')).toBeInTheDocument();
    const img = within(dialog()).getByRole('img', { name: 'Front mockup 1' });
    expect(img).toHaveAttribute('src', `${PIXEL}#1`);
    expect(img).toHaveAttribute('srcset', `${PIXEL}#1 640w, ${PIXEL}#1b 960w`);
    expect(img).toHaveAttribute('sizes', SIZES);
    expect(img).toHaveAttribute('loading', 'eager');
    expect(img).toHaveClass('object-contain');
  });

  it('steps to the next photo and says so in a polite region', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Next image' }));
    expect(within(dialog()).getByText('Photo 2 of 3')).toBeInTheDocument();
    expect(within(dialog()).getByRole('img', { name: 'Front mockup 2' })).toBeInTheDocument();
    const live = within(dialog()).getByRole('status');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).toHaveTextContent('Photo 2 of 3: Front mockup 2');
  });

  it('closes on Esc and reports the id of the photo shown last', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Next image' }));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith('p2');
  });

  it('closes from the Close viewer button too', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} start={2} />);
    await user.click(screen.getByRole('button', { name: 'Close viewer' }));
    expect(onClose).toHaveBeenCalledWith('p3');
  });

  it('has no axe violations while open', async () => {
    const { container } = render(<Harness />);
    await expectNoAxeViolations(container);
  });
});
