import { fireEvent, render, screen, within } from '@testing-library/react';
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

/** LazyImage's box around the shown photo. */
function imageBox(): HTMLElement {
  const box = dialog().querySelector('img')?.parentElement;
  if (box === null || box === undefined) {
    throw new Error('no image box');
  }
  return box;
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

describe('PhotoViewer keys and wrap', () => {
  it('ArrowRight on the last photo wraps to the first', async () => {
    const user = userEvent.setup();
    render(<Harness start={2} />);
    await user.keyboard('{ArrowRight}');
    expect(within(dialog()).getByText('Photo 1 of 3')).toBeInTheDocument();
  });

  it('ArrowLeft on the first photo wraps to the last', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.keyboard('{ArrowLeft}');
    expect(within(dialog()).getByText('Photo 3 of 3')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Photo 3 of 3: Front mockup 3');
  });

  it('Previous and Next wrap too', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Previous image' }));
    expect(within(dialog()).getByText('Photo 3 of 3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next image' }));
    expect(within(dialog()).getByText('Photo 1 of 3')).toBeInTheDocument();
  });

  it('steps with the arrow keys from a focused button inside the dialog', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole('button', { name: 'Next image' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(within(dialog()).getByText('Photo 2 of 3')).toBeInTheDocument();
  });

  it('leaves Alt + Arrow to the browser', () => {
    render(<Harness />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Close viewer' }), { key: 'ArrowRight', altKey: true });
    expect(within(dialog()).getByText('Photo 1 of 3')).toBeInTheDocument();
  });

  it('cycles Tab through Close, Previous, Next and Open Full Size only', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const names = (): string => {
      const active = document.activeElement;
      return active?.getAttribute('aria-label') ?? active?.textContent ?? '';
    };
    const seen = [names()];
    for (let step = 0; step < 4; step += 1) {
      await user.tab();
      seen.push(names());
    }
    expect(seen).toEqual([
      'Close viewer',
      'Previous image',
      'Next image',
      'Open Full Size (opens in a new tab)',
      'Close viewer',
    ]);
  });

  it('shows no Previous and no Next with one photo, and the arrows do nothing', async () => {
    const user = userEvent.setup();
    render(<Harness photos={[photo(1)]} />);
    expect(screen.queryByRole('button', { name: 'Previous image' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Next image' })).toBeNull();
    expect(within(dialog()).getByText('Photo 1 of 1')).toBeInTheDocument();
    await user.keyboard('{ArrowRight}{ArrowLeft}');
    expect(within(dialog()).getByText('Photo 1 of 1')).toBeInTheDocument();
  });
});

describe('PhotoViewer Open Full Size', () => {
  it('is a link to the full-size address that opens a new tab safely, with a hidden notice', () => {
    render(<Harness />);
    const link = screen.getByRole('link', { name: 'Open Full Size (opens in a new tab)' });
    expect(link).toHaveAttribute('href', 'https://res.cloudinary.com/csps/image/upload/v1/orders/p1-full.jpg');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(within(link).getByText('(opens in a new tab)')).toHaveClass('absolute', 'overflow-hidden');
  });

  it('follows the photo shown', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Next image' }));
    expect(screen.getByRole('link', { name: /Open Full Size/ })).toHaveAttribute(
      'href',
      'https://res.cloudinary.com/csps/image/upload/v1/orders/p2-full.jpg',
    );
  });

  it('is not rendered when the photo has no full-size address', () => {
    render(<Harness photos={[photo(1, { fullSize: undefined })]} />);
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('PhotoViewer failed image', () => {
  it('shows the placeholder named by the alt inside the box, and Previous, Next and Close still work', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.error(within(dialog()).getByRole('img', { name: 'Front mockup 1' }));
    const box = within(dialog()).getByRole('img', { name: 'Front mockup 1' });
    expect(box.tagName).toBe('DIV');
    expect(box.querySelector('img')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Next image' }));
    expect(within(dialog()).getByText('Photo 2 of 3')).toBeInTheDocument();
    expect(within(dialog()).getByRole('img', { name: 'Front mockup 2' }).tagName).toBe('IMG');
    await user.click(screen.getByRole('button', { name: 'Close viewer' }));
    expect(onClose).toHaveBeenCalledWith('p2');
  });

  it('has no axe violations with a failed image', async () => {
    const { container } = render(<Harness />);
    fireEvent.error(within(dialog()).getByRole('img', { name: 'Front mockup 1' }));
    await expectNoAxeViolations(container);
  });
});

describe('PhotoViewer live changes', () => {
  it('keeps the same photo by id when others come and go', () => {
    const { rerender } = render(<Harness start={1} />);
    rerender(<Harness start={1} photos={[THREE[1] as PhotoViewerPhoto, THREE[2] as PhotoViewerPhoto]} />);
    expect(within(dialog()).getByText('Photo 1 of 2')).toBeInTheDocument();
    expect(within(dialog()).getByRole('img', { name: 'Front mockup 2' })).toBeInTheDocument();
  });

  it('moves to the nearest position when the shown photo is gone', () => {
    const { rerender } = render(<Harness start={1} />);
    rerender(<Harness start={1} photos={[THREE[0] as PhotoViewerPhoto, THREE[2] as PhotoViewerPhoto]} />);
    expect(within(dialog()).getByText('Photo 2 of 2')).toBeInTheDocument();
    expect(within(dialog()).getByRole('img', { name: 'Front mockup 3' })).toBeInTheDocument();
  });

  it('clamps to the new last photo when the shown last photo is gone', () => {
    const { rerender } = render(<Harness start={2} />);
    rerender(<Harness start={2} photos={[THREE[0] as PhotoViewerPhoto, THREE[1] as PhotoViewerPhoto]} />);
    expect(within(dialog()).getByText('Photo 2 of 2')).toBeInTheDocument();
    expect(within(dialog()).getByRole('img', { name: 'Front mockup 2' })).toBeInTheDocument();
  });

  it('calls onClose with the last shown id when no photos are left', () => {
    const onClose = vi.fn();
    const { rerender } = render(<Harness start={1} onClose={onClose} />);
    expect(onClose).not.toHaveBeenCalled();
    rerender(<Harness start={1} photos={[]} onClose={onClose} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith('p2');
  });
});

describe('PhotoViewer look and layout', () => {
  it('uses the brand-fixed dark chrome in both themes, with a reduced-motion variant for the scrim fade', () => {
    render(<Harness />);
    expect(dialog()).toHaveAttribute('data-theme', 'dark');
    expect(dialog()).toHaveClass('fixed', 'inset-0', 'animate-csp-fade', 'motion-reduce:animate-none');
  });

  it('moves Previous and Next under the photo at 639 px and below, 44 px there and 56 px above', () => {
    render(<Harness />);
    for (const name of ['Previous image', 'Next image']) {
      const button = screen.getByRole('button', { name });
      expect(button).toHaveClass('size-14', 'vp-lt-sm:size-11', 'vp-lt-sm:row-start-2');
    }
    expect(within(dialog()).getByRole('link').parentElement).toHaveClass('vp-lt-sm:contents');
    expect(screen.getByRole('button', { name: 'Close viewer' })).toHaveClass('size-11');
  });

  it('caps the image box at min(680px, 100dvh - 200px) tall and fits the whole photo', () => {
    render(<Harness />);
    expect(imageBox()).toHaveClass('max-h-[min(680px,calc(100dvh-200px))]');
    expect(within(dialog()).getByRole('img', { name: 'Front mockup 1' })).toHaveClass('object-contain');
  });

  it('wraps a long description across lines in the caption and hides it from assistive technology', () => {
    const long = 'Front mockup in red and black with the club name across the chest '.repeat(6).trim();
    render(<Harness photos={[photo(1, { alt: long })]} />);
    const caption = within(dialog()).getByText(long, { selector: 'p' });
    expect(caption).toHaveAttribute('aria-hidden', 'true');
    expect(caption).toHaveClass('wrap-anywhere');
    expect(caption.parentElement).toHaveClass('flex-wrap');
  });

  it('falls back to a 4 / 3 box when the photo has no stored size', () => {
    render(<Harness photos={[photo(1, { viewer: { src: `${PIXEL}#x`, srcSet: `${PIXEL}#x 640w` } })]} />);
    expect(imageBox().style.getPropertyValue('--ratio')).toBe('4 / 3');
  });

  it('boxes the photo at its own ratio', () => {
    render(<Harness />);
    expect(imageBox().style.getPropertyValue('--ratio')).toBe('1200 / 800');
  });

  it.each([
    ['Tall', 400, 1600, '400 / 1600'],
    ['Wide', 1600, 400, '1600 / 400'],
  ] as const)('fits a very %s photo with contain and never crops it', (shape, width, height, ratio) => {
    const viewer = { src: `${PIXEL}#t`, srcSet: `${PIXEL}#t 640w`, width, height };
    render(<Harness photos={[photo(1, { alt: shape, viewer })]} />);
    const img = within(dialog()).getByRole('img', { name: shape });
    expect(img).toHaveClass('object-contain');
    expect(img).not.toHaveClass('object-cover');
    expect(imageBox().style.getPropertyValue('--ratio')).toBe(ratio);
  });
});

describe('PhotoViewer page behind it', () => {
  it('makes the page inert and locks body scroll while open, and releases both on close', () => {
    const { rerender } = render(
      <div>
        <main data-testid="page">Page</main>
        <Harness />
      </div>,
    );
    expect(screen.getByTestId('page')).toHaveAttribute('inert');
    expect(document.body).toHaveClass('overflow-hidden');
    rerender(
      <div>
        <main data-testid="page">Page</main>
      </div>,
    );
    expect(screen.getByTestId('page')).not.toHaveAttribute('inert');
    expect(document.body).not.toHaveClass('overflow-hidden');
  });

  it('returns focus to the element that had it before opening', () => {
    function Opener() {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button
            type="button"
            onClick={() => {
              setOpen(true);
            }}
          >
            Open photo
          </button>
          {open && (
            <PhotoViewer
              photos={THREE}
              index={0}
              onIndexChange={() => undefined}
              onClose={() => {
                setOpen(false);
              }}
              label="Order photos"
            />
          )}
        </div>
      );
    }
    render(<Opener />);
    const trigger = screen.getByRole('button', { name: 'Open photo' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('button', { name: 'Close viewer' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Close viewer' }));
    expect(trigger).toHaveFocus();
  });
});
