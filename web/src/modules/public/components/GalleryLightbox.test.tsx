import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import {
  demoGallery,
  itemUpload,
  itemWithFourPhotos,
  itemWithNoPhoto,
  makeGalleryItem,
  singleItemFilter,
  type PublicGalleryItemFixture,
} from '@/test/publicFixtures';
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

/** The frame around the photo box: the tap zones and the swipe sit on it. */
function photoFrame(): HTMLElement {
  const frame = dialog().querySelector<HTMLElement>('[data-lightbox-frame]');
  if (frame === null) {
    throw new Error('no photo frame');
  }
  return frame;
}

/** The photo's img inside `root`. */
function imageIn(root: ParentNode): HTMLImageElement {
  const image = root.querySelector('img');
  if (image === null) {
    throw new Error('no image');
  }
  return image;
}

/** A pointer drag across the frame by (dx, dy). */
function swipe(dx: number, dy: number) {
  const frame = photoFrame();
  fireEvent.pointerDown(frame, { pointerId: 1, isPrimary: true, clientX: 300, clientY: 300 });
  fireEvent.pointerUp(frame, { pointerId: 1, isPrimary: true, clientX: 300 + dx, clientY: 300 + dy });
}

/** The names of the focusable buttons and links, in the order Tab visits them, without the group `skip` matches. */
async function tabOrder(skip: RegExp): Promise<string[]> {
  const user = userEvent.setup();
  const names: string[] = [];
  const first = screen.getByRole('button', { name: 'Close viewer' });
  names.push(first.getAttribute('aria-label') ?? '');
  for (let step = 0; step < 12; step += 1) {
    await user.tab();
    const active = document.activeElement;
    const name = active?.getAttribute('aria-label') ?? active?.textContent ?? '';
    if (name === 'Close viewer') {
      break;
    }
    names.push(name);
  }
  return names.filter((name) => !skip.test(name));
}

describe('GalleryLightbox phone tap zones and swipe (C-35, 02 D-06)', () => {
  it('has the two 56px buttons (hidden at 767px and below) and two tap zones named Previous photo and Next photo (shown only there)', () => {
    render(<Harness start={2} />);
    for (const name of ['Previous image', 'Next image']) {
      expect(screen.getByRole('button', { name })).toHaveClass('vp-lt-md:hidden');
    }
    for (const name of ['Previous photo', 'Next photo']) {
      const zone = screen.getByRole('button', { name });
      expect(zone).toHaveClass('hidden', 'vp-lt-md:block');
      expect(zone.tabIndex).toBe(0);
      expect(photoFrame()).toContainElement(zone);
    }
  });

  it('moves to the previous and next item from the tap zones, with wrap', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Previous photo' }));
    expect(within(dialog()).getByText('16 / 16')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next photo' }));
    expect(within(dialog()).getByText('1 / 16')).toBeInTheDocument();
  });

  it('gives the tap zones a visible 2px chrome-ink focus ring', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Next photo' })).toHaveClass(
      'focus-visible:outline-2',
      'focus-visible:outline-ink',
    );
  });

  it('tabs Close, Previous, Next, the thumbnails, then Get a quote on a desktop', async () => {
    render(<Harness items={[itemWithFourPhotos, ...demoGallery.items.slice(1)]} />);
    expect(await tabOrder(/ photo$/)).toEqual([
      'Close viewer',
      'Previous image',
      'Next image',
      'Show photo 1 of 4',
      'Show photo 2 of 4',
      'Show photo 3 of 4',
      'Show photo 4 of 4',
      'Get a quote for something like this',
    ]);
  });

  it('tabs Close, the tap zones, the thumbnails, then Get a quote on a phone', async () => {
    render(<Harness items={[itemWithFourPhotos, ...demoGallery.items.slice(1)]} />);
    expect(await tabOrder(/ image$/)).toEqual([
      'Close viewer',
      'Previous photo',
      'Next photo',
      'Show photo 1 of 4',
      'Show photo 2 of 4',
      'Show photo 3 of 4',
      'Show photo 4 of 4',
      'Get a quote for something like this',
    ]);
  });

  it('moves to the next item on a swipe left and to the previous on a swipe right, with wrap', () => {
    render(<Harness />);
    swipe(-60, 10);
    expect(within(dialog()).getByText('2 / 16')).toBeInTheDocument();
    swipe(60, -10);
    expect(within(dialog()).getByText('1 / 16')).toBeInTheDocument();
    swipe(60, 0);
    expect(within(dialog()).getByText('16 / 16')).toBeInTheDocument();
  });

  it('does not move on a short swipe or one that is more vertical than horizontal', () => {
    render(<Harness start={4} />);
    swipe(-40, 0);
    swipe(-60, 80);
    expect(within(dialog()).getByText('5 / 16')).toBeInTheDocument();
  });

  it('has no Previous, Next, tap zones or swipe with one item in the filter', async () => {
    const user = userEvent.setup();
    render(<Harness items={singleItemFilter} />);
    for (const name of ['Previous image', 'Next image', 'Previous photo', 'Next photo']) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
    swipe(-60, 0);
    await user.keyboard('{ArrowRight}');
    expect(within(dialog()).getByText('1 / 1')).toBeInTheDocument();
    expect(within(dialog()).getByText('Lone Rangers')).toBeInTheDocument();
  });
});

describe('GalleryLightbox thumbnails (D-30, D-12)', () => {
  it('shows a row of four thumbnails named "Show photo i of 4", the first with aria-current, and the cover first', () => {
    render(<Harness items={[itemWithFourPhotos]} />);
    const thumbs = [1, 2, 3, 4].map((number) =>
      screen.getByRole('button', { name: `Show photo ${String(number)} of 4` }),
    );
    expect(thumbs[0]).toHaveAttribute('aria-current', 'true');
    for (const other of thumbs.slice(1)) {
      expect(other).not.toHaveAttribute('aria-current');
    }
    const cover = itemWithFourPhotos.photos[0];
    expect(thumbs[0]?.querySelector('img')).toHaveAttribute('src', cover?.thumbSrc);
    expect(thumbs[0]?.querySelector('img')).toHaveAttribute('alt', '');
    expect(
      within(dialog()).getByRole('img', { name: 'Brgy. Sample Ballers, Basketball work, photo 1 of 4' }),
    ).toHaveAttribute('src', cover?.viewerSrc);
  });

  it('draws each thumbnail as a 56px square that is 44px at 420px and below, with a 2px chrome-ink ring on the shown one', () => {
    render(<Harness items={[itemWithFourPhotos]} />);
    const shown = screen.getByRole('button', { name: 'Show photo 1 of 4' });
    const other = screen.getByRole('button', { name: 'Show photo 2 of 4' });
    expect(shown).toHaveClass('size-14', 'vp-xs:size-11', 'ring-2', 'ring-ink');
    expect(other).toHaveClass('size-14', 'vp-xs:size-11');
    expect(other).not.toHaveClass('ring-2');
  });

  it('shows the chosen photo, adds ", photo 3 of 4" to the alt and says "Photo 3 of 4" in the polite region', async () => {
    const user = userEvent.setup();
    render(<Harness items={[itemWithFourPhotos]} />);
    await user.click(screen.getByRole('button', { name: 'Show photo 3 of 4' }));

    expect(screen.getByRole('button', { name: 'Show photo 3 of 4' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'Show photo 1 of 4' })).not.toHaveAttribute('aria-current');
    expect(
      within(dialog()).getByRole('img', { name: 'Brgy. Sample Ballers, Basketball work, photo 3 of 4' }),
    ).toHaveAttribute('src', itemWithFourPhotos.photos[2]?.viewerSrc);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('status')).toHaveTextContent('Photo 3 of 4');
  });

  it('has no thumbnail row for an item with one photo', () => {
    render(<Harness start={2} />);
    expect(screen.queryByRole('button', { name: /^Show photo/ })).toBeNull();
  });

  it('opens the next item on its cover again', async () => {
    const user = userEvent.setup();
    render(<Harness items={[itemWithFourPhotos, ...demoGallery.items.slice(1, 3)]} />);
    await user.click(screen.getByRole('button', { name: 'Show photo 3 of 4' }));
    await user.keyboard('{ArrowRight}{ArrowLeft}');
    expect(screen.getByRole('button', { name: 'Show photo 1 of 4' })).toHaveAttribute('aria-current', 'true');
    expect(
      within(dialog()).getByRole('img', { name: 'Brgy. Sample Ballers, Basketball work, photo 1 of 4' }),
    ).toBeInTheDocument();
  });
});

describe('GalleryLightbox caption, announcements and photos (D-13)', () => {
  it('says "Item 4 of 16: {team}, Basketball" in the polite region on an item change', async () => {
    const user = userEvent.setup();
    render(<Harness start={2} />);
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('status')).toHaveTextContent('Item 4 of 16: Riverside Rim Rockers, Basketball');
  });

  it('shows the team and "{Basketball} · 17 pcs · {note}" for an upload', () => {
    const upload = makeGalleryItem({ team: 'Hoop Dreams', lineKey: 'basketball', note: 'Dri-fit mesh, V-neck' });
    render(<Harness items={[upload]} />);
    expect(within(dialog()).getByText('Hoop Dreams')).toBeInTheDocument();
    expect(within(dialog()).getByText('Basketball · 17 pcs · Dri-fit mesh, V-neck')).toBeInTheDocument();
  });

  it('leaves out the parts it does not have', () => {
    const items = [
      makeGalleryItem({ team: 'No Pieces', lineKey: 'basketball', pieces: null, note: 'Dri-fit mesh' }),
      makeGalleryItem({ team: 'One Piece', lineKey: 'basketball', pieces: 1, note: null }),
      makeGalleryItem({ team: 'Nothing Else', lineKey: 'basketball', pieces: null, note: null }),
    ];
    render(<Harness items={items} />);
    expect(within(dialog()).getByText('Basketball · Dri-fit mesh')).toBeInTheDocument();
    fireEvent.keyDown(dialog(), { key: 'ArrowRight' });
    expect(within(dialog()).getByText('Basketball · 1 pc')).toBeInTheDocument();
    fireEvent.keyDown(dialog(), { key: 'ArrowRight' });
    expect(within(dialog()).getByText('Basketball')).toBeInTheDocument();
  });

  it('shows the note of an upload but never a staff photo description', () => {
    render(<Harness items={[itemUpload]} />);
    expect(within(dialog()).getByText('Moto · 17 pcs · Dri-fit mesh, V-neck')).toBeInTheDocument();
    expect(dialog().textContent).toBe(
      [
        '1 / 1',
        'Item 1 of 1',
        'Sample Riders MC',
        'Moto · 17 pcs · Dri-fit mesh, V-neck',
        'Get a quote for something like this',
      ].join(''),
    );
  });

  it('wraps a long team name inside the caption', () => {
    const long = makeGalleryItem({
      team: 'Barangay Sampaguita Elementary School Varsity Basketball Team',
      lineKey: 'basketball',
    });
    render(<Harness items={[long]} />);
    expect(within(dialog()).getByText(long.team)).toHaveClass('wrap-anywhere', 'uppercase');
  });

  it("draws the line's jersey, named by the alt, when the item has no photo, and has no thumbnails", () => {
    render(<Harness items={[itemWithNoPhoto]} />);
    expect(within(dialog()).getByRole('img', { name: 'Sample Office Polo, Polo work' })).toBeInTheDocument();
    expect(dialog().querySelector('img')).toBeNull();
    expect(dialog().querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it('shows the placeholder named by the alt when the photo fails to load', () => {
    render(<Harness items={singleItemFilter} />);
    fireEvent.error(imageIn(dialog()));
    expect(dialog().querySelector('img')).toBeNull();
    expect(within(dialog()).getByRole('img', { name: 'Lone Rangers, Basketball work' })).toBeInTheDocument();
  });

  it('closes and hands over to the page when "Get a quote for something like this" is pressed', async () => {
    const user = userEvent.setup();
    const onQuote = vi.fn();
    render(<Harness onQuote={onQuote} />);
    const link = screen.getByRole('link', { name: 'Get a quote for something like this' });
    expect(link).toHaveAttribute('href', '/contact');
    await user.click(link);
    expect(onQuote).toHaveBeenCalledTimes(1);
  });

  it('has no axe violations with four photos, with no photo, with one item and on a failed photo', async () => {
    const four = render(<Harness items={[itemWithFourPhotos, ...demoGallery.items.slice(1, 4)]} />);
    await expectNoAxeViolations(four.container);
    four.unmount();

    const none = render(<Harness items={[itemWithNoPhoto, ...demoGallery.items.slice(1, 4)]} />);
    await expectNoAxeViolations(none.container);
    none.unmount();

    const one = render(<Harness items={singleItemFilter} />);
    await expectNoAxeViolations(one.container);
    fireEvent.error(imageIn(one.container));
    await expectNoAxeViolations(one.container);
  });
});
