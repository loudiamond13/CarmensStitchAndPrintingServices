import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { demoGallery, type PublicGalleryItemFixture } from '@/test/publicFixtures';
import { GalleryLightbox } from './GalleryLightbox';
import { GalleryLightboxFrame } from './GalleryStates';

// GalleryLightbox (UI-SPEC G2; GAL-02, C-35, D-30): the dialog over the Gallery masonry. The items are the active filter's,
// in gallery order; the parent owns the shown index, the closing and the quote hop.

interface HarnessProps {
  items?: readonly PublicGalleryItemFixture[];
  start?: number;
  onClose?: () => void;
  onQuote?: () => void;
}

function Harness({
  items = demoGallery.items,
  start = 0,
  onClose = () => undefined,
  onQuote = () => undefined,
}: HarnessProps) {
  const [index, setIndex] = useState(start);
  return (
    <MemoryRouter>
      <GalleryLightbox items={items} index={index} onIndexChange={setIndex} onClose={onClose} onQuote={onQuote} />
    </MemoryRouter>
  );
}

function dialog(): HTMLElement {
  return screen.getByRole('dialog', { name: 'Gallery image viewer' });
}

describe('GalleryLightbox open and step (GAL-02)', () => {
  it('opens as a modal dialog named "Gallery image viewer" with focus on Close viewer', () => {
    render(<Harness start={2} />);
    expect(dialog()).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Close viewer' })).toHaveFocus();
  });

  it('shows "3 / 16" hidden from assistive technology, with a hidden "Item 3 of 16" in its place', () => {
    render(<Harness start={2} />);
    const visible = within(dialog()).getByText('3 / 16');
    expect(visible).toHaveAttribute('aria-hidden', 'true');
    expect(within(dialog()).getByText('Item 3 of 16')).toBeInTheDocument();
  });

  it('shows the photo with the alt "{team}, {Basketball} work" and loads it first', () => {
    render(<Harness start={2} />);
    const img = within(dialog()).getByRole('img', { name: 'Poblacion Fastbreak, Basketball work' });
    expect(img).toHaveAttribute('loading', 'eager');
    expect(img).toHaveClass('object-contain');
  });

  it('Next on the last item shows the first, and Previous on the first shows the last (wrap)', async () => {
    const user = userEvent.setup();
    render(<Harness start={15} />);
    await user.click(screen.getByRole('button', { name: 'Next image' }));
    expect(within(dialog()).getByText('1 / 16')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Previous image' }));
    expect(within(dialog()).getByText('16 / 16')).toBeInTheDocument();
  });

  it('moves by ArrowRight and ArrowLeft from anywhere in the dialog, with wrap', async () => {
    const user = userEvent.setup();
    render(<Harness start={15} />);
    await user.keyboard('{ArrowRight}');
    expect(within(dialog()).getByText('1 / 16')).toBeInTheDocument();
    await user.keyboard('{ArrowLeft}');
    expect(within(dialog()).getByText('16 / 16')).toBeInTheDocument();
  });

  it('follows the order it is given, so the position counts the filter', async () => {
    const user = userEvent.setup();
    const basketball = demoGallery.items.filter((item) => item.lineKey === 'basketball');
    render(<Harness items={basketball} />);
    expect(within(dialog()).getByText('1 / 4')).toBeInTheDocument();
    await user.keyboard('{ArrowLeft}');
    expect(within(dialog()).getByText('4 / 4')).toBeInTheDocument();
    expect(within(dialog()).getByRole('img', { name: 'Riverside Rim Rockers, Basketball work' })).toBeInTheDocument();
  });

  it('closes on Esc and from the Close viewer button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Close viewer' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('has no axe violations while open', async () => {
    const { container } = render(<Harness start={2} />);
    await expectNoAxeViolations(container);
  });
});

describe('GalleryLightboxFrame (loading, UI-SPEC G2)', () => {
  it('is the dialog shell with a skeleton in the 4 / 3 box, marked busy, and has no axe violations', async () => {
    const { container } = render(<GalleryLightboxFrame />);
    const frame = screen.getByRole('dialog', { name: 'Gallery image viewer' });
    expect(frame).toHaveAttribute('aria-modal', 'true');
    expect(frame).toHaveAttribute('aria-busy', 'true');
    expect(frame.querySelector('[data-gallery-skeleton="lightbox"]')).not.toBeNull();
    await expectNoAxeViolations(container);
  });
});
